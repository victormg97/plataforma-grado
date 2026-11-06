'use client';

/**
 * Detail panel of a materia, opened from the `ced_materia` URL parameter
 * (Requirements 5.7, 5.8, 11.6, 11.13, 13.14, 16.10, 18.5).
 *
 * Shows código and nombre, descripción, the temario in the rich-text editor and the materia
 * enlaces. The temario and the enlaces are requested only when the panel opens (the structure
 * list never carries them), and a loading indicator covers both until they arrive.
 *
 * Presence: while the temario editor has focus the user is tracked as editing this materia; other
 * users on the same materia are listed as "<nombre> está editando".
 *
 * Read-only users see the rendered temario in a read-only editor and only hyperlinks for enlaces.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/common/Button';
import { cn } from '@/lib/utils';
import { CEDULARIOS_I18N_NAMESPACE } from '@/lib/cedularios/errors';
import { sanitizeDoc, type TiptapDoc } from '@/lib/cedularios/richtext';
import type { Database } from '@/lib/supabase/types';
import { codigoDeError } from '../hooks/cedulariosQuery';
import { useCedulariosUrl } from '../hooks/CedulariosUrlContext';
import { useCedulariosAction } from '../hooks/useCedulariosAction';
import { useCedularioPresence } from '../hooks/useCedularioPresence';
import { useEnlaces } from '../hooks/useEnlaces';
import { useMateria } from '../hooks/useMaterias';
import { RichTextField } from '../editor/RichTextField';
import { EnlacesList } from '../enlaces/EnlacesList';

type MateriaRow = Database['public']['Tables']['materias']['Row'];

export interface MateriaPanelProps {
  cedularioId: string;
  materiaId: string;
  /** False for alumno, lector and a profesor who cannot edit this cedulario. */
  puedeEditar: boolean;
  /** Called by the close button. Defaults to `clearMateria()` of the URL state. */
  onClose?: () => void;
  /** Header slot for the Edit and Delete buttons (task 10.8). */
  extraActions?: ReactNode;
}

/** Stored temario to a document the editor accepts. `null` is an empty temario. */
function temarioADoc(temario: unknown): TiptapDoc | null {
  if (temario === null || temario === undefined) return null;
  return sanitizeDoc(temario, 'con_tablas');
}

const CLASE_PANEL =
  'flex flex-col gap-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 sm:p-5';

export function MateriaPanel(props: MateriaPanelProps) {
  // `key` remounts the editor, the enlaces and the focus state when another materia is opened.
  return <MateriaPanelContenedor key={props.materiaId} {...props} />;
}

function BotonCerrar({ onClick }: { onClick: () => void }) {
  const t = useTranslations(CEDULARIOS_I18N_NAMESPACE);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('materia.cerrar_panel')}
      title={t('materia.cerrar_panel')}
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-colors',
        'hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)] [&_svg]:size-4',
      )}
    >
      <X aria-hidden="true" />
    </button>
  );
}

function MateriaPanelContenedor({
  cedularioId,
  materiaId,
  puedeEditar,
  onClose,
  extraActions,
}: MateriaPanelProps) {
  const t = useTranslations(CEDULARIOS_I18N_NAMESPACE);
  const { translateError } = useCedulariosAction();
  const { clearMateria } = useCedulariosUrl();
  const consulta = useMateria(materiaId);
  const { editores, setEditing } = useCedularioPresence(cedularioId, materiaId);

  const cerrarBase = onClose ?? clearMateria;
  const cerrarRef = useRef(cerrarBase);
  useEffect(() => {
    cerrarRef.current = cerrarBase;
  }, [cerrarBase]);

  const cerrar = useCallback(() => {
    setEditing(false);
    cerrarRef.current();
  }, [setEditing]);

  const materia = consulta.data ?? null;
  // A materia of another cedulario (stale or edited URL) is treated as not found.
  const noEncontrada =
    consulta.isSuccess && (materia === null || materia.cedulario_id !== cedularioId);

  // Not found or not visible: tell the user and drop the parameter so the tree shows the parent level.
  useEffect(() => {
    if (!noEncontrada) return;
    toast.error(t('materia.no_encontrada'), { id: 'cedularios-materia-no-encontrada' });
    setEditing(false);
    cerrarRef.current();
  }, [noEncontrada, setEditing, t]);

  if (consulta.isPending) {
    return (
      <aside aria-label={t('materia.panel_titulo')} aria-busy="true" className={CLASE_PANEL}>
        <div className="flex items-start justify-between gap-3">
          <div role="status" aria-live="polite" className="min-w-0 flex-1 space-y-2">
            <span className="sr-only">{t('materia.cargando')}</span>
            <div aria-hidden="true" className="h-5 w-24 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)]" />
            <div aria-hidden="true" className="h-6 w-3/4 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)]" />
          </div>
          <BotonCerrar onClick={cerrar} />
        </div>
        <div aria-hidden="true" className="h-40 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)]" />
      </aside>
    );
  }

  if (consulta.isError && consulta.data === undefined) {
    return (
      <aside aria-label={t('materia.panel_titulo')} className={CLASE_PANEL}>
        <div className="flex items-start justify-between gap-3">
          <div
            role="alert"
            className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-error)] p-3"
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
          <BotonCerrar onClick={cerrar} />
        </div>
      </aside>
    );
  }

  if (materia === null || noEncontrada) {
    return (
      <aside aria-label={t('materia.panel_titulo')} className={CLASE_PANEL}>
        <div className="flex items-start justify-between gap-3">
          <p role="status" className="text-sm text-[var(--color-text-secondary)]">
            {t('materia.no_encontrada')}
          </p>
          <BotonCerrar onClick={cerrar} />
        </div>
      </aside>
    );
  }

  return (
    <MateriaPanelContenido
      materia={materia}
      puedeEditar={puedeEditar}
      editores={editores}
      setEditing={setEditing}
      onCerrar={cerrar}
      extraActions={extraActions}
    />
  );
}

interface ContenidoProps {
  materia: MateriaRow;
  puedeEditar: boolean;
  editores: { userId: string; nombre: string }[];
  setEditing: (editando: boolean) => void;
  onCerrar: () => void;
  extraActions?: ReactNode;
}

function MateriaPanelContenido({
  materia,
  puedeEditar,
  editores,
  setEditing,
  onCerrar,
  extraActions,
}: ContenidoProps) {
  const t = useTranslations(CEDULARIOS_I18N_NAMESPACE);
  const enlaces = useEnlaces('materia', materia.id);

  // Content of the first load. Later server versions reach the editor through `remoto`.
  const [contenidoInicial] = useState<TiptapDoc | null>(() => temarioADoc(materia.temario));
  // The query keeps the same object between refetches with equal data, so this stays referentially stable.
  const remoto = useMemo(() => temarioADoc(materia.temario), [materia.temario]);

  const alEnfocar = useCallback(() => {
    if (puedeEditar) setEditing(true);
  }, [puedeEditar, setEditing]);
  const alDesenfocar = useCallback(() => setEditing(false), [setEditing]);

  // Presence ends when the panel unmounts, the materia changes (remount) or edit rights are lost.
  useEffect(() => {
    if (!puedeEditar) setEditing(false);
    return () => setEditing(false);
  }, [puedeEditar, setEditing]);

  const cargandoContenido = enlaces.isPending;
  const descripcion = materia.descripcion?.trim() ?? '';

  return (
    <aside aria-labelledby={`materia-titulo-${materia.id}`} className={CLASE_PANEL}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <span className="inline-flex max-w-full items-center rounded-full border border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-text-primary)]">
            <span className="sr-only">{t('materia.campos.codigo')}: </span>
            <span className="break-all">{materia.codigo}</span>
          </span>
          <h2
            id={`materia-titulo-${materia.id}`}
            className="break-words text-lg font-semibold text-[var(--color-text-primary)]"
          >
            <span className="sr-only">{t('materia.campos.nombre')}: </span>
            {materia.nombre}
          </h2>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {extraActions}
          <BotonCerrar onClick={onCerrar} />
        </div>
      </header>

      {editores.length > 0 && (
        <ul aria-live="polite" className="space-y-1">
          {editores.map((editor) => (
            <li
              key={editor.userId}
              className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]"
            >
              <Pencil className="size-3.5 shrink-0 text-[var(--color-brand-gold)]" aria-hidden="true" />
              <span className="break-words">{t('materia.editando_ahora', { nombre: editor.nombre })}</span>
            </li>
          ))}
        </ul>
      )}

      <section aria-labelledby={`materia-descripcion-${materia.id}`} className="space-y-1.5">
        <h3
          id={`materia-descripcion-${materia.id}`}
          className="text-base font-semibold text-[var(--color-text-primary)]"
        >
          {t('materia.descripcion')}
        </h3>
        {descripcion !== '' ? (
          <p className="whitespace-pre-line break-words text-sm text-[var(--color-text-secondary)]">
            {descripcion}
          </p>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">{t('materia.sin_descripcion')}</p>
        )}
      </section>

      {cargandoContenido ? (
        <div role="status" aria-live="polite" aria-busy="true" className="space-y-2">
          <p className="text-sm text-[var(--color-text-muted)]">{t('materia.cargando_contenido')}</p>
          <div aria-hidden="true" className="h-40 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)]" />
          <div aria-hidden="true" className="h-16 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)]" />
        </div>
      ) : (
        <>
          <section aria-labelledby={`materia-temario-${materia.id}`} className="space-y-1.5">
            <h3
              id={`materia-temario-${materia.id}`}
              className="text-base font-semibold text-[var(--color-text-primary)]"
            >
              {t('materia.temario')}
            </h3>
            <RichTextField
              scope="materia-temario"
              recordId={materia.id}
              contenidoInicial={contenidoInicial}
              puedeEditar={puedeEditar}
              updatedAt={materia.updated_at}
              remoto={remoto}
              onFocus={alEnfocar}
              onBlur={alDesenfocar}
            />
          </section>

          <EnlacesList scope="materia" parentId={materia.id} puedeEditar={puedeEditar} />
        </>
      )}
    </aside>
  );
}
