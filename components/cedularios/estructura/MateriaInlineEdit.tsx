'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resaltar } from '@/lib/cedularios/busqueda';
import { CEDULARIOS_I18N_NAMESPACE } from '@/lib/cedularios/errors';
import { cedulariosKeys } from '@/lib/cedularios/keys';
import { materiaSchema } from '@/lib/cedularios/schemas';
import type { FilaVisible } from '@/lib/cedularios/tree';
import type { MateriaEstructura } from '@/lib/queries/cedularios/materias';
import { useCedulariosAction } from '../hooks/useCedulariosAction';
import { useEditarMateria } from '../hooks/useMaterias';
import { Resaltado, extractoDescripcion, type MateriaTreeRowProps } from './MateriaTreeRow';

/** Only código and nombre are edited in place: `orden` changes by moving, never by typing. */
const inlineSchema = materiaSchema.pick({ codigo: true, nombre: true });

const CLASE_INPUT =
  'h-7 min-w-0 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-2 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:ring-2 focus:ring-[var(--color-brand-gold)]/20 aria-[invalid=true]:border-[var(--color-error)]';

type CampoInline = 'codigo' | 'nombre';

export interface MateriaInlineEditProps {
  cedularioId: string;
  /** Row received by `renderContenido` of `MateriaTreeEditable`. */
  fila: FilaVisible;
  /** Props of the base row received by `renderContenido` (search highlight, roving tabindex). */
  propsFila: MateriaTreeRowProps;
}

/**
 * Código and nombre of a tree row with in-place editing (Requirements 4.15, 11.5, 12.1, 12.2, 15.1).
 *
 * Plug it in through `renderContenido` of `MateriaTreeEditable`. Click the pencil or double-click
 * the text to edit. Enter, or leaving both fields, saves; Escape discards and restores the stored
 * values. A value that fails validation (código 1-30, nombre 1-300 after trimming) or a duplicated
 * código shows the message in the row and keeps the edit open. Clicks and keys inside the editor
 * never reach the row, so it does not select or navigate while editing.
 */
export function MateriaInlineEdit({ cedularioId, fila, propsFila }: MateriaInlineEditProps) {
  const t = useTranslations(CEDULARIOS_I18N_NAMESPACE);
  const { translateFieldError, showError } = useCedulariosAction();
  const qc = useQueryClient();
  // Validation and duplicate errors are shown in the row; other failures use the error toast.
  const editar = useEditarMateria({ skipErrorToast: true });

  const { nodo } = fila;
  const { consulta, coincidencia, tabulable } = propsFila;

  const idError = useId();
  const [editando, setEditando] = useState(false);
  const [codigo, setCodigo] = useState(nodo.codigo);
  const [nombre, setNombre] = useState(nodo.nombre);
  const [error, setError] = useState<{ campo: CampoInline; mensaje: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  const contenedor = useRef<HTMLDivElement>(null);
  const entradaCodigo = useRef<HTMLInputElement>(null);
  const entradaNombre = useRef<HTMLInputElement>(null);
  const botonLapiz = useRef<HTMLButtonElement>(null);
  /** True from the moment a save starts until it fails: ignores Enter/blur fired meanwhile. */
  const enCursoRef = useRef(false);
  /** The edit ended (saved or discarded): a blur caused by removing the inputs is not a save. */
  const terminadaRef = useRef(true);

  const iniciar = () => {
    if (editando) return;
    terminadaRef.current = false;
    enCursoRef.current = false;
    setCodigo(nodo.codigo);
    setNombre(nodo.nombre);
    setError(null);
    setEditando(true);
  };

  // Focus the código field when the edit starts.
  useEffect(() => {
    if (!editando) return;
    entradaCodigo.current?.focus();
    entradaCodigo.current?.select();
  }, [editando]);

  // Keyboard users get the focus back on the pencil when the inputs disappear.
  const eraEditando = useRef(false);
  useEffect(() => {
    if (eraEditando.current && !editando) {
      const activo = document.activeElement;
      if (activo === null || activo === document.body) botonLapiz.current?.focus();
    }
    eraEditando.current = editando;
  }, [editando]);

  const salir = () => {
    terminadaRef.current = true;
    enCursoRef.current = false;
    setError(null);
    setGuardando(false);
    setEditando(false);
  };

  const mostrarError = (campo: CampoInline, mensaje: string) => {
    setError({ campo, mensaje });
    (campo === 'codigo' ? entradaCodigo : entradaNombre).current?.focus();
  };

  const guardar = async () => {
    if (terminadaRef.current || enCursoRef.current) return;

    const valores = inlineSchema.safeParse({ codigo, nombre });
    if (!valores.success) {
      const problema = valores.error.issues[0];
      const campo: CampoInline = problema?.path[0] === 'nombre' ? 'nombre' : 'codigo';
      mostrarError(campo, translateFieldError(problema?.message ?? 'validacion'));
      return;
    }

    const { codigo: codigoNuevo, nombre: nombreNuevo } = valores.data;
    if (codigoNuevo === nodo.codigo && nombreNuevo === nodo.nombre) {
      salir();
      return;
    }

    enCursoRef.current = true;
    setGuardando(true);
    setError(null);
    // The edit action overwrites descripción with what it receives: send the stored one.
    const resultado = await editar.mutateAsync({
      id: nodo.id,
      input: { codigo: codigoNuevo, nombre: nombreNuevo, descripcion: nodo.descripcion ?? '' },
    });

    if (resultado.ok) {
      // Show the saved values right away; the invalidation done by the hook refreshes the rest.
      qc.setQueryData<MateriaEstructura[]>(cedulariosKeys.materias(cedularioId), (previo) =>
        previo?.map((n) =>
          n.id === nodo.id ? { ...n, codigo: resultado.data.codigo, nombre: resultado.data.nombre } : n,
        ),
      );
      salir();
      return;
    }

    // Failure: keep editing with the typed values.
    enCursoRef.current = false;
    setGuardando(false);
    const { code, fields } = resultado.error;
    const campoServidor = Object.keys(fields ?? {}).find((c): c is CampoInline => c === 'codigo' || c === 'nombre');
    if (code === 'codigo_duplicado_nivel') {
      mostrarError('codigo', translateFieldError('codigo_duplicado_nivel'));
    } else if (campoServidor && fields) {
      mostrarError(campoServidor, translateFieldError(fields[campoServidor]));
    } else {
      showError(resultado.error);
    }
  };

  const descartar = () => {
    // Restore the stored values.
    setCodigo(nodo.codigo);
    setNombre(nodo.nombre);
    salir();
  };

  const detener = (event: MouseEvent | KeyboardEvent) => event.stopPropagation();

  const alTeclear = (event: KeyboardEvent<HTMLInputElement>) => {
    // Nothing typed here is a row shortcut (arrows, Space, Home/End move the caret).
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      void guardar();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      descartar();
    }
  };

  const alPerderFoco = (event: FocusEvent<HTMLDivElement>) => {
    // Moving between the two fields is not leaving the editor.
    if (event.relatedTarget instanceof Node && contenedor.current?.contains(event.relatedTarget)) return;
    void guardar();
  };

  const segmentosCodigo = useMemo(
    () => (coincidencia === 'texto' ? resaltar(nodo.codigo, consulta) : null),
    [coincidencia, nodo.codigo, consulta],
  );
  const segmentosNombre = useMemo(
    () => (coincidencia === 'texto' ? resaltar(nodo.nombre, consulta) : null),
    [coincidencia, nodo.nombre, consulta],
  );
  const segmentosDescripcion = useMemo(
    () => (coincidencia === 'texto' && nodo.descripcion ? extractoDescripcion(nodo.descripcion, consulta) : null),
    [coincidencia, nodo.descripcion, consulta],
  );

  if (!editando) {
    return (
      <div className="flex min-w-0 flex-1 items-baseline gap-2" onDoubleClick={iniciar}>
        <span className="shrink-0 font-semibold text-[var(--color-text-primary)]">
          {segmentosCodigo ? <Resaltado segmentos={segmentosCodigo} /> : nodo.codigo}
        </span>
        <span className="min-w-0 truncate text-[var(--color-text-primary)]" title={nodo.nombre}>
          {segmentosNombre ? <Resaltado segmentos={segmentosNombre} /> : nodo.nombre}
        </span>
        {segmentosDescripcion && (
          <span className="hidden min-w-0 shrink truncate text-xs text-[var(--color-text-muted)] md:inline">
            <Resaltado segmentos={segmentosDescripcion} />
          </span>
        )}
        <button
          ref={botonLapiz}
          type="button"
          tabIndex={tabulable ? 0 : -1}
          aria-label={t('estructura.editar_en_linea_aria', { nombre: nodo.nombre })}
          title={t('estructura.editar')}
          onClick={(event) => {
            // Editing is not selecting: the row must not open the panel.
            event.stopPropagation();
            iniciar();
          }}
          onKeyDown={detener}
          className={cn(
            'inline-flex size-6 shrink-0 cursor-pointer items-center justify-center self-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] transition-colors',
            'hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]',
          )}
        >
          <Pencil aria-hidden="true" className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={contenedor}
      role="group"
      aria-label={t('estructura.editar_en_linea_aria', { nombre: nodo.nombre })}
      aria-busy={guardando}
      onClick={detener}
      onDoubleClick={detener}
      onKeyDown={detener}
      onBlur={alPerderFoco}
      className="flex min-w-0 flex-1 items-center gap-2"
    >
      <input
        ref={entradaCodigo}
        type="text"
        value={codigo}
        readOnly={guardando}
        autoComplete="off"
        aria-label={t('estructura.editar_codigo_aria', { nombre: nodo.nombre })}
        aria-invalid={error?.campo === 'codigo'}
        aria-describedby={error?.campo === 'codigo' ? idError : undefined}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          setCodigo(event.target.value);
          if (error?.campo === 'codigo') setError(null);
        }}
        onKeyDown={alTeclear}
        className={cn(CLASE_INPUT, 'w-24 shrink-0')}
      />
      <input
        ref={entradaNombre}
        type="text"
        value={nombre}
        readOnly={guardando}
        autoComplete="off"
        aria-label={t('estructura.editar_nombre_aria', { nombre: nodo.nombre })}
        aria-invalid={error?.campo === 'nombre'}
        aria-describedby={error?.campo === 'nombre' ? idError : undefined}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          setNombre(event.target.value);
          if (error?.campo === 'nombre') setError(null);
        }}
        onKeyDown={alTeclear}
        className={cn(CLASE_INPUT, 'min-w-24 flex-1')}
      />
      {error ? (
        <p
          id={idError}
          role="alert"
          title={error.mensaje}
          className="min-w-0 max-w-[45%] shrink truncate text-xs text-[var(--color-error)]"
        >
          {error.mensaje}
        </p>
      ) : (
        <span className="sr-only">{t('estructura.inline_ayuda')}</span>
      )}
    </div>
  );
}
