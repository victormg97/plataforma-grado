'use client';

import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import type { z } from 'zod';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import type { ActionError } from '@/lib/cedularios/action-result';
import { sugerirCodigo } from '@/lib/cedularios/codigo';
import { sanitizeDoc, type TiptapDoc } from '@/lib/cedularios/richtext';
import { LIMITES, materiaSchema } from '@/lib/cedularios/schemas';
import { puedeCrearHijo, type MateriaNodo } from '@/lib/cedularios/tree';
import type { Database } from '@/lib/supabase/types';
import { codigoDeError } from '../hooks/cedulariosQuery';
import { useCedulariosAction } from '../hooks/useCedulariosAction';
import { useCrearMateria, useEditarMateria, useMateria, useMateriasTree } from '../hooks/useMaterias';
import { RichTextField } from '../editor/RichTextField';

type MateriaRow = Database['public']['Tables']['materias']['Row'];

/** The parent comes from the props of the form, not from a field, and `orden` is never edited. */
const materiaFormSchema = materiaSchema.omit({ parent_id: true });
type MateriaFormInput = z.input<typeof materiaFormSchema>;
type MateriaFormData = z.output<typeof materiaFormSchema>;
type CampoMateria = keyof MateriaFormInput;

const CAMPOS: readonly CampoMateria[] = ['codigo', 'nombre', 'descripcion'];

function esCampo(valor: string): valor is CampoMateria {
  return (CAMPOS as readonly string[]).includes(valor);
}

const CLASE_INPUT =
  'w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:ring-2 focus:ring-[var(--color-brand-gold)]/20 aria-[invalid=true]:border-[var(--color-error)]';

/** Stored temario to a document the editor accepts. `null` is an empty temario. */
function temarioADoc(temario: unknown): TiptapDoc | null {
  if (temario === null || temario === undefined) return null;
  return sanitizeDoc(temario, 'con_tablas');
}

// ---------------------------------------------------------------------------
// Field wrapper (label, error beneath, character counter)
// ---------------------------------------------------------------------------

interface CampoProps {
  id: string;
  etiqueta: string;
  requerido?: boolean;
  /** Translated error message, if any. */
  error?: string;
  /** Help text shown under the field. */
  ayuda?: string;
  contador: { actual: number; max: number };
  children: (props: { 'aria-invalid': 'true' | 'false'; 'aria-describedby': string | undefined }) => ReactNode;
}

function Campo({ id, etiqueta, requerido = false, error, ayuda, contador, children }: CampoProps) {
  const t = useTranslations('cedularios');
  const idError = `${id}-error`;
  const idAyuda = `${id}-ayuda`;
  const idContador = `${id}-contador`;
  const describedBy = [error ? idError : null, ayuda ? idAyuda : null, idContador].filter(Boolean).join(' ');
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-[var(--color-text-primary)]">
        {etiqueta}{' '}
        {requerido ? (
          <span className="text-[var(--color-error)]" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="text-xs font-normal text-[var(--color-text-muted)]">({t('comun.opcional')})</span>
        )}
      </label>
      {children({
        'aria-invalid': error ? 'true' : 'false',
        'aria-describedby': describedBy,
      })}
      {ayuda && (
        <p id={idAyuda} className="text-xs text-[var(--color-text-muted)]">
          {ayuda}
        </p>
      )}
      <div className="flex items-start justify-between gap-3">
        {error ? (
          <p id={idError} role="alert" className="text-xs text-[var(--color-error)]">
            {error}
          </p>
        ) : (
          <span />
        )}
        <p
          id={idContador}
          className={
            contador.actual > contador.max
              ? 'shrink-0 text-xs text-[var(--color-error)]'
              : 'shrink-0 text-xs text-[var(--color-text-muted)]'
          }
        >
          {t('comun.caracteres', { actual: contador.actual, max: contador.max })}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Temario (edit mode only, loaded on demand)
// ---------------------------------------------------------------------------

function TemarioCampo({ materia }: { materia: MateriaRow }) {
  const t = useTranslations('cedularios');
  // Content of the first load. Later server versions reach the editor through `remoto`.
  const [contenidoInicial] = useState<TiptapDoc | null>(() => temarioADoc(materia.temario));
  const remoto = useMemo(() => temarioADoc(materia.temario), [materia.temario]);
  const idTitulo = `materia-form-temario-${materia.id}`;

  return (
    <section aria-labelledby={idTitulo} className="flex flex-col gap-1.5">
      <h3 id={idTitulo} className="text-sm font-medium text-[var(--color-text-primary)]">
        {t('materia.campos.temario')}
      </h3>
      <RichTextField
        scope="materia-temario"
        recordId={materia.id}
        contenidoInicial={contenidoInicial}
        puedeEditar
        updatedAt={materia.updated_at}
        remoto={remoto}
      />
    </section>
  );
}

/** The temario is requested only when the edit modal opens (`useMateria` is not used by the tree). */
function TemarioEdicion({ materiaId }: { materiaId: string }) {
  const t = useTranslations('cedularios');
  const { translateError } = useCedulariosAction();
  const consulta = useMateria(materiaId);

  if (consulta.isPending) {
    return (
      <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-2">
        <p className="text-sm text-[var(--color-text-muted)]">{t('materia.cargando_contenido')}</p>
        <div aria-hidden="true" className="h-32 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)]" />
      </div>
    );
  }

  if (consulta.isError && consulta.data === undefined) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-error)] p-3"
      >
        <p className="text-sm text-[var(--color-error)]">
          {translateError({ code: codigoDeError(consulta.error) })}
        </p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          loading={consulta.isFetching}
          onClick={() => void consulta.refetch()}
        >
          {t('comun.reintentar')}
        </Button>
      </div>
    );
  }

  if (consulta.data === null || consulta.data === undefined) {
    return (
      <p role="status" className="text-sm text-[var(--color-text-secondary)]">
        {t('materia.no_encontrada')}
      </p>
    );
  }

  return <TemarioCampo materia={consulta.data} />;
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

export interface MateriaCreada {
  id: string;
  /** Parent the materia was created under (null = root level). */
  parentId: string | null;
}

export interface MateriaFormProps {
  cedularioId: string;
  /** Id of the materia to edit. Omit it (or pass null) to create one. */
  materiaId?: string | null;
  /** Parent of the new materia when creating (null or omitted = root level). Ignored when editing. */
  parentId?: string | null;
  onClose: () => void;
  /** Called after a materia was created, before the form closes (the host expands the parent). */
  onCreada?: (materia: MateriaCreada) => void;
}

/**
 * Add materia / Add child / Edit form in a modal (Requirements 4.2 to 4.6, 12.1, 12.2, 15.1, 15.3).
 *
 * The form is open while it is mounted. It reads the structure list (`useMateriasTree`), so it
 * needs the tree to be loaded: a missing materia or parent closes it. When creating, the código is
 * prefilled with `sugerirCodigo`. When editing, the temario editor appears below the fields and the
 * temario is loaded on demand with `useMateria(id)`; it autosaves by itself, independently of the
 * "Save" button, which saves código, nombre and descripción.
 */
export function MateriaForm({ cedularioId, materiaId = null, parentId = null, onClose, onCreada }: MateriaFormProps) {
  const t = useTranslations('cedularios');
  const estructura = useMateriasTree(cedularioId);
  const flat = estructura.data;
  const esEdicion = materiaId !== null;

  const nodo = esEdicion && flat ? (flat.find((n) => n.id === materiaId && n.activo) ?? null) : null;
  const padre = !esEdicion && parentId !== null && flat ? (flat.find((n) => n.id === parentId) ?? null) : null;

  const noExiste = flat !== undefined && (esEdicion ? nodo === null : parentId !== null && (padre === null || !padre.activo));

  // The materia or its parent may be gone (deleted by someone else, stale link): close the form.
  useEffect(() => {
    if (noExiste) onClose();
  }, [noExiste, onClose]);

  if (flat !== undefined && !noExiste) {
    return (
      <MateriaFormContenido
        key={materiaId ?? `nueva:${parentId ?? 'raiz'}`}
        cedularioId={cedularioId}
        flat={flat}
        nodo={nodo}
        padre={padre}
        parentId={esEdicion ? (nodo?.parentId ?? null) : parentId}
        onClose={onClose}
        onCreada={onCreada}
      />
    );
  }

  const titulo = esEdicion ? t('materia.formulario.titulo_editar') : t('materia.formulario.titulo_crear');
  return (
    <Modal open onClose={onClose} title={titulo}>
      {estructura.isError ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center" role="alert">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t(`errores.${codigoDeError(estructura.error)}`)}
          </p>
          <Button type="button" variant="secondary" size="sm" onClick={() => void estructura.refetch()}>
            {t('comun.reintentar')}
          </Button>
        </div>
      ) : (
        <div role="status" aria-busy="true" aria-label={t('comun.cargando')} className="flex animate-pulse flex-col gap-4">
          <div className="h-10 rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)]" />
          <div className="h-10 rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)]" />
          <div className="h-24 rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)]" />
        </div>
      )}
    </Modal>
  );
}

interface MateriaFormContenidoProps {
  cedularioId: string;
  flat: MateriaNodo[];
  /** Materia being edited; null when creating. */
  nodo: MateriaNodo | null;
  /** Parent when creating a child; null for a root materia or when editing. */
  padre: MateriaNodo | null;
  /** Parent under which a new materia is created (null = root). */
  parentId: string | null;
  onClose: () => void;
  onCreada?: (materia: MateriaCreada) => void;
}

function MateriaFormContenido({
  cedularioId,
  flat,
  nodo,
  padre,
  parentId,
  onClose,
  onCreada,
}: MateriaFormContenidoProps) {
  const t = useTranslations('cedularios');
  const { translateFieldError, showError } = useCedulariosAction();
  const formId = useId();
  const esEdicion = nodo !== null;

  // Field errors are shown beneath the fields, so the generic error toast is skipped.
  const crear = useCrearMateria({ skipErrorToast: true });
  const editar = useEditarMateria({ skipErrorToast: true });
  const guardando = crear.isPending || editar.isPending;

  // Suggested código: computed once, when the form opens (the tree may change while it is open).
  const [valoresIniciales] = useState<MateriaFormInput>(() => {
    if (nodo) return { codigo: nodo.codigo, nombre: nodo.nombre, descripcion: nodo.descripcion ?? '' };
    const hermanos = flat.filter((n) => n.parentId === parentId);
    return { codigo: sugerirCodigo(padre, hermanos), nombre: '', descripcion: '' };
  });

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<MateriaFormInput, unknown, MateriaFormData>({
    resolver: zodResolver(materiaFormSchema),
    defaultValues: valoresIniciales,
  });

  const largoCodigo = (useWatch({ control, name: 'codigo' }) ?? '').length;
  const largoNombre = (useWatch({ control, name: 'nombre' }) ?? '').length;
  const largoDescripcion = (useWatch({ control, name: 'descripcion' }) ?? '').length;

  const aplicarErrores = (error: ActionError) => {
    let hayErrorDeCampo = false;
    for (const [campo, codigo] of Object.entries(error.fields ?? {})) {
      if (!esCampo(campo)) continue;
      setError(campo, { type: 'server', message: codigo }, { shouldFocus: !hayErrorDeCampo });
      hayErrorDeCampo = true;
    }
    // A duplicated código carries no field name: it belongs beneath the código field.
    if (!hayErrorDeCampo && error.code === 'codigo_duplicado_nivel') {
      setError('codigo', { type: 'server', message: 'codigo_duplicado_nivel' }, { shouldFocus: true });
      hayErrorDeCampo = true;
    }
    // No field to blame (permissions, connection...): show the message.
    if (!hayErrorDeCampo) showError(error);
  };

  const alEnviar = async (valores: MateriaFormData) => {
    if (nodo) {
      const resultado = await editar.mutateAsync({
        id: nodo.id,
        input: { codigo: valores.codigo, nombre: valores.nombre, descripcion: valores.descripcion ?? '' },
      });
      if (resultado.ok) {
        onClose();
        return;
      }
      aplicarErrores(resultado.error);
      return;
    }

    // Depth is checked here too: a child of a nivel 5 materia never reaches the server.
    const permitido = puedeCrearHijo(flat, parentId);
    if (!permitido.ok) {
      showError({ code: permitido.razon === 'nivel_maximo' ? 'nivel_maximo' : 'padre_invalido' });
      return;
    }

    const resultado = await crear.mutateAsync({
      cedulario_id: cedularioId,
      parent_id: parentId,
      codigo: valores.codigo,
      nombre: valores.nombre,
      descripcion: valores.descripcion ?? '',
    });
    if (resultado.ok) {
      onCreada?.({ id: resultado.data.id, parentId });
      onClose();
      return;
    }
    // The values stay in the form so the user can correct them.
    aplicarErrores(resultado.error);
  };

  const cerrar = () => {
    if (!guardando) onClose();
  };

  const mensajeError = (campo: CampoMateria): string | undefined => {
    const mensaje = errors[campo]?.message;
    return mensaje ? translateFieldError(String(mensaje)) : undefined;
  };

  let titulo = t('materia.formulario.titulo_crear');
  if (esEdicion) titulo = t('materia.formulario.titulo_editar');
  else if (padre) titulo = t('materia.formulario.titulo_hija', { padre: padre.nombre });

  return (
    <Modal
      open
      onClose={cerrar}
      title={titulo}
      size={esEdicion ? 'lg' : 'default'}
      footer={
        <div className="flex w-full items-center justify-end gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={cerrar} disabled={guardando}>
            {t('comun.cancelar')}
          </Button>
          <Button type="submit" form={formId} variant="primary" size="sm" loading={guardando}>
            {guardando ? t('comun.guardando') : t('materia.formulario.guardar')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <form id={formId} onSubmit={handleSubmit(alEnviar)} noValidate className="flex flex-col gap-4">
          <Campo
            id={`${formId}-codigo`}
            etiqueta={t('materia.campos.codigo')}
            requerido
            error={mensajeError('codigo')}
            ayuda={t('materia.ayudas.codigo')}
            contador={{ actual: largoCodigo, max: LIMITES.materiaCodigo }}
          >
            {(ariaProps) => (
              <input
                id={`${formId}-codigo`}
                {...register('codigo')}
                {...ariaProps}
                className={`${CLASE_INPUT} h-10`}
                placeholder={t('materia.placeholders.codigo')}
                autoComplete="off"
                aria-required="true"
                readOnly={guardando}
              />
            )}
          </Campo>

          <Campo
            id={`${formId}-nombre`}
            etiqueta={t('materia.campos.nombre')}
            requerido
            error={mensajeError('nombre')}
            contador={{ actual: largoNombre, max: LIMITES.materiaNombre }}
          >
            {(ariaProps) => (
              <input
                id={`${formId}-nombre`}
                {...register('nombre')}
                {...ariaProps}
                className={`${CLASE_INPUT} h-10`}
                placeholder={t('materia.placeholders.nombre')}
                autoComplete="off"
                aria-required="true"
                readOnly={guardando}
              />
            )}
          </Campo>

          <Campo
            id={`${formId}-descripcion`}
            etiqueta={t('materia.campos.descripcion')}
            error={mensajeError('descripcion')}
            contador={{ actual: largoDescripcion, max: LIMITES.materiaDescripcion }}
          >
            {(ariaProps) => (
              <textarea
                id={`${formId}-descripcion`}
                {...register('descripcion')}
                {...ariaProps}
                rows={3}
                className={`${CLASE_INPUT} min-h-20 resize-y py-2`}
                placeholder={t('materia.placeholders.descripcion')}
                readOnly={guardando}
              />
            )}
          </Campo>
        </form>

        {nodo && <TemarioEdicion materiaId={nodo.id} />}
      </div>
    </Modal>
  );
}
