'use client';

/**
 * Materia picker of the assign wizard.
 * Two modes in a radio group: "All materias" (default, resolved on the server at the moment of
 * the operation) or "Choose materias" on top of SubconjuntoArbol.
 * The component is controlled. The value is `'todas'` or the list of selected materia ids.
 * In "choose" mode an empty selection shows a validation error and flags the group as invalid.
 *
 * Tree tools (choose mode):
 * - "Expand all" / "Collapse all" change only what is visible, never the selection.
 * - "Mark all branches" is a union and never loses the selection. "Unmark all branches" asks for
 *   confirmation when something is selected. Both leave an inline "Undo" until the next manual
 *   change, so one slip never costs the work already done.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { useMateriasTree } from '@/components/cedularios/hooks/useMaterias';
import {
  accionRamas,
  idsConHijos,
  type SeleccionMaterias,
} from '@/lib/cedularios/seguimiento/asignacion-wizard';
import { SubconjuntoArbol } from '../subconjunto/SubconjuntoArbol';

export type { SeleccionMaterias };

interface MateriasSelectorProps {
  /** Cedulario whose materia tree is shown in "choose" mode. */
  cedularioId: string | null | undefined;
  value: SeleccionMaterias;
  onChange: (value: SeleccionMaterias) => void;
  /** Ids of materias that hold progress data (marker in the tree). */
  conAvance?: ReadonlySet<string>;
  disabled?: boolean;
  /** Shows the empty-selection error even before the user touched the picker (failed submit). */
  forzarError?: boolean;
  /** Collapsed materias, controlled by the parent so going back and forth keeps the tree. */
  colapsados?: ReadonlySet<string>;
  onColapsadosChange?: (colapsados: Set<string>) => void;
  /** True while the selector has its own layer open (the unmark confirmation). */
  onCapaPropiaChange?: (abierta: boolean) => void;
  className?: string;
}

type ModoMaterias = 'todas' | 'elegir';

interface UltimaAccion {
  accion: 'marcar' | 'desmarcar';
  /** Selection before the action, restored by "Undo". */
  previa: string[];
}

export function MateriasSelector({
  cedularioId,
  value,
  onChange,
  conAvance,
  disabled = false,
  forzarError = false,
  colapsados: colapsadosExternos,
  onColapsadosChange,
  onCapaPropiaChange,
  className,
}: MateriasSelectorProps) {
  const t = useTranslations('cedularios.seguimiento');
  const tw = useTranslations('cedularios.seguimiento.asignar.wizard');
  const baseId = useId();
  const nombreGrupo = `${baseId}-modo`;
  const idError = `${baseId}-error`;
  const idAyuda = `${baseId}-ayuda`;

  const modo: ModoMaterias = value === 'todas' ? 'todas' : 'elegir';
  const [tocado, setTocado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [ultimaAccion, setUltimaAccion] = useState<UltimaAccion | null>(null);
  const [colapsadosPropios, setColapsadosPropios] = useState<ReadonlySet<string>>(() => new Set());
  const colapsados = colapsadosExternos ?? colapsadosPropios;
  const cambiarColapsados = onColapsadosChange ?? setColapsadosPropios;

  // Report the own layer (the confirmation) to the overlay; always release it on unmount
  const onCapaRef = useRef(onCapaPropiaChange);
  useEffect(() => {
    onCapaRef.current = onCapaPropiaChange;
  });
  useEffect(() => {
    onCapaRef.current?.(confirmando);
  }, [confirmando]);
  useEffect(() => {
    return () => onCapaRef.current?.(false);
  }, []);

  // Remembers the last explicit selection so switching modes back and forth does not lose it.
  const ultimaSeleccion = useRef<string[]>([]);

  // The tree is fetched only when it is shown.
  const arbol = useMateriasTree(modo === 'elegir' ? cedularioId : null);

  const seleccion = useMemo<ReadonlySet<string>>(
    () => new Set(value === 'todas' ? [] : value),
    [value],
  );

  const flat = useMemo(() => arbol.data ?? [], [arbol.data]);
  const hayMaterias = flat.some((materia) => materia.activo);
  const conHijos = useMemo(() => idsConHijos(flat), [flat]);
  const todoExpandido = conHijos.every((id) => !colapsados.has(id));
  const todoContraido = conHijos.every((id) => colapsados.has(id));

  const cambiarModo = (siguiente: ModoMaterias) => {
    if (siguiente === modo) return;
    if (value !== 'todas') ultimaSeleccion.current = value;
    setUltimaAccion(null);
    onChange(siguiente === 'todas' ? 'todas' : [...ultimaSeleccion.current]);
  };

  const cambiarSeleccion = useCallback(
    (siguiente: Set<string>) => {
      const ids = Array.from(siguiente);
      ultimaSeleccion.current = ids;
      setTocado(true);
      setUltimaAccion(null);
      onChange(ids);
    },
    [onChange],
  );

  const aplicarRamas = (accion: 'marcar' | 'desmarcar') => {
    const { siguiente } = accionRamas({ accion, seleccion, flat });
    const previa = Array.from(seleccion);
    const ids = Array.from(siguiente);
    ultimaSeleccion.current = ids;
    setTocado(true);
    setUltimaAccion({ accion, previa });
    onChange(ids);
  };

  const pedirRamas = (accion: 'marcar' | 'desmarcar') => {
    if (accionRamas({ accion, seleccion, flat }).requiereConfirmacion) {
      setConfirmando(true);
      return;
    }
    aplicarRamas(accion);
  };

  const deshacer = () => {
    if (!ultimaAccion) return;
    ultimaSeleccion.current = ultimaAccion.previa;
    setUltimaAccion(null);
    onChange(ultimaAccion.previa);
  };

  const vacia = modo === 'elegir' && seleccion.size === 0;
  const mostrarError = vacia && (tocado || forzarError);

  const claseOpcion =
    'flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)] has-[:checked]:border-[var(--color-brand-gold)] has-[:checked]:bg-[var(--color-brand-gold-muted)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--color-brand-gold)] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60';
  const claseHerramienta =
    'inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)] disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <fieldset
      disabled={disabled}
      aria-invalid={mostrarError}
      aria-describedby={mostrarError ? `${idAyuda} ${idError}` : idAyuda}
      className={cn('flex min-w-0 flex-col gap-2', className)}
    >
      <legend className="mb-1 text-sm font-medium text-[var(--color-text-primary)]">
        {t('asignar.materias.etiqueta')}
      </legend>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className={claseOpcion}>
          <input
            type="radio"
            name={nombreGrupo}
            checked={modo === 'todas'}
            onChange={() => cambiarModo('todas')}
            className="size-4 shrink-0 accent-[var(--color-brand-gold)]"
          />
          <span>{t('asignar.materias.todas')}</span>
        </label>
        <label className={claseOpcion}>
          <input
            type="radio"
            name={nombreGrupo}
            checked={modo === 'elegir'}
            onChange={() => cambiarModo('elegir')}
            className="size-4 shrink-0 accent-[var(--color-brand-gold)]"
          />
          <span>{t('asignar.materias.elegir')}</span>
        </label>
      </div>

      <p id={idAyuda} className="text-xs text-[var(--color-text-muted)]">
        {t('asignar.materias.ayuda')}
      </p>

      {modo === 'elegir' && (
        <div className="flex min-w-0 flex-col gap-2">
          {arbol.isPending && Boolean(cedularioId) && (
            <p role="status" className="text-sm text-[var(--color-text-muted)]">
              {t('comun.cargando')}
            </p>
          )}

          {arbol.isError && (
            <div role="alert" className="flex flex-col items-start gap-2">
              <p className="text-sm text-[var(--color-error)]">{t('comun.error_carga')}</p>
              <button
                type="button"
                onClick={() => void arbol.refetch()}
                className="rounded-[var(--radius-sm)] text-sm font-medium text-[var(--color-brand-gold)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]"
              >
                {t('comun.reintentar')}
              </button>
            </div>
          )}

          {arbol.isSuccess && !hayMaterias && (
            <p className="text-sm text-[var(--color-text-muted)]">{t('comun.materias_conteo', { count: 0 })}</p>
          )}

          {arbol.isSuccess && hayMaterias && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={claseHerramienta}
                    disabled={conHijos.length === 0 || todoExpandido}
                    onClick={() => cambiarColapsados(new Set())}
                  >
                    <ChevronsUpDown aria-hidden="true" className="size-3.5" />
                    {tw('expandir_todo')}
                  </button>
                  <button
                    type="button"
                    className={claseHerramienta}
                    disabled={conHijos.length === 0 || todoContraido}
                    onClick={() => cambiarColapsados(new Set(conHijos))}
                  >
                    <ChevronsDownUp aria-hidden="true" className="size-3.5" />
                    {tw('contraer_todo')}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={claseHerramienta}
                    onClick={() => pedirRamas('marcar')}
                  >
                    {tw('marcar_ramas')}
                  </button>
                  <button
                    type="button"
                    className={claseHerramienta}
                    disabled={seleccion.size === 0}
                    onClick={() => pedirRamas('desmarcar')}
                  >
                    {tw('desmarcar_ramas')}
                  </button>
                </div>
              </div>

              <div aria-live="polite">
                {ultimaAccion && (
                  <p className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-xs text-[var(--color-text-primary)]">
                    <span>
                      {ultimaAccion.accion === 'marcar' ? tw('aviso_marcadas') : tw('aviso_desmarcadas')}
                    </span>
                    <button
                      type="button"
                      onClick={deshacer}
                      className="rounded-[var(--radius-sm)] font-medium text-[var(--color-brand-gold)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]"
                    >
                      {tw('deshacer')}
                    </button>
                  </p>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto rounded-[var(--radius-md)]">
                <SubconjuntoArbol
                  flat={flat}
                  seleccion={seleccion}
                  onChange={cambiarSeleccion}
                  conAvance={conAvance}
                  disabled={disabled}
                  colapsados={colapsados}
                  onColapsadosChange={cambiarColapsados}
                />
              </div>
            </>
          )}

          <div className="flex flex-col gap-0.5 text-xs" aria-live="polite">
            <span className="text-[var(--color-text-muted)]">
              {t('asignar.materias.seleccionadas', { count: seleccion.size })}
            </span>
            {mostrarError && (
              <span id={idError} role="alert" className="text-[var(--color-error)]">
                {t('asignar.materias.error_vacia')}
              </span>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmando}
        onClose={() => setConfirmando(false)}
        onConfirm={() => {
          setConfirmando(false);
          aplicarRamas('desmarcar');
        }}
        title={tw('confirmar_desmarcar_titulo')}
        description={tw('confirmar_desmarcar_descripcion', { count: seleccion.size })}
        confirmText={tw('confirmar_desmarcar_ok')}
        cancelText={tw('seguir_editando')}
        contentClassName="z-[80]"
        isDanger
      />
    </fieldset>
  );
}
