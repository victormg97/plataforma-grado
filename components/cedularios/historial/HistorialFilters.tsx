'use client';

import { useId, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AppSelect } from '@/components/common/AppSelect';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/ui/input';
import { CEDULARIOS_I18N_NAMESPACE } from '@/lib/cedularios/errors';
import { historialFiltrosSchema } from '@/lib/cedularios/schemas';
import type { HistorialFiltros } from '@/lib/queries/cedularios/historial';
import type { CedulariosTranslator } from '../hooks/useCedulariosAction';

/** Tables that have a label under `cedularios.historial.tablas`. */
export const HISTORIAL_TABLAS = [
  'universidades',
  'cedularios',
  'cedulario_enlaces',
  'materias',
  'materia_enlaces',
  'cedulario_profesores',
] as const;

export interface HistorialUsuarioOpcion {
  id: string;
  nombre: string;
}

export interface HistorialFiltersProps {
  /** Filters currently applied to the list. */
  value: HistorialFiltros;
  /**
   * Users offered in the usuario select. The tab passes the users seen in the loaded entries
   * (the RPC has no "list of authors" endpoint), including the selected one.
   */
  usuarios: HistorialUsuarioOpcion[];
  /** Called only with a valid filter set; an invalid one is never applied. */
  onApply: (filtros: HistorialFiltros) => void;
  disabled?: boolean;
}

type CampoConError = 'tabla' | 'usuario_id' | 'desde' | 'hasta';

function limpiar(filtros: HistorialFiltros): HistorialFiltros {
  const salida: HistorialFiltros = {};
  if (filtros.tabla) salida.tabla = filtros.tabla;
  if (filtros.usuarioId) salida.usuarioId = filtros.usuarioId;
  if (filtros.desde) salida.desde = filtros.desde;
  if (filtros.hasta) salida.hasta = filtros.hasta;
  return salida;
}

/**
 * Filters of the Historial tab: tabla, usuario and date range (Requirement 8.11).
 *
 * Edits are kept in a draft. "Aplicar" sends the draft to `onApply` only when it passes
 * `historialFiltrosSchema`. When `desde` is after `hasta` the error is shown under the date
 * range and nothing is applied, so the list on screen stays as it was.
 */
export function HistorialFilters({ value, usuarios, onApply, disabled = false }: HistorialFiltersProps) {
  const t = useTranslations(CEDULARIOS_I18N_NAMESPACE) as unknown as CedulariosTranslator & {
    has: (key: string) => boolean;
  };
  const idBase = useId();
  const idTabla = `${idBase}-tabla`;
  const idUsuario = `${idBase}-usuario`;
  const idDesde = `${idBase}-desde`;
  const idHasta = `${idBase}-hasta`;
  const idErrorFechas = `${idBase}-error-fechas`;

  const [borrador, setBorrador] = useState<HistorialFiltros>(() => limpiar(value));

  const errores = useMemo(() => {
    const resultado = historialFiltrosSchema.safeParse({
      tabla: borrador.tabla || undefined,
      usuario_id: borrador.usuarioId || undefined,
      desde: borrador.desde || undefined,
      hasta: borrador.hasta || undefined,
    });
    const salida: Partial<Record<CampoConError, string>> = {};
    if (!resultado.success) {
      for (const issue of resultado.error.issues) {
        const campo = issue.path[0] as CampoConError | undefined;
        if (campo && !salida[campo]) salida[campo] = issue.message;
      }
    }
    return salida;
  }, [borrador]);

  const mensajeError = (codigo: string | undefined): string | null => {
    if (!codigo) return null;
    return t.has(`errores.${codigo}`) ? t(`errores.${codigo}`) : t('errores.validacion');
  };

  const errorTabla = mensajeError(errores.tabla);
  const errorUsuario = mensajeError(errores.usuario_id);
  // One message under the date range, whichever date it comes from.
  const errorFechas = mensajeError(errores.hasta ?? errores.desde);
  const hayErrores = Boolean(errorTabla || errorUsuario || errorFechas);

  const opcionesTabla = [
    { value: '', label: t('historial.filtros.tabla_todas') },
    ...HISTORIAL_TABLAS.map((tabla) => ({ value: tabla, label: t(`historial.tablas.${tabla}`) })),
  ];
  const opcionesUsuario = [
    { value: '', label: t('historial.filtros.usuario_todos') },
    ...usuarios.map((u) => ({ value: u.id, label: u.nombre })),
  ];

  const hayFiltrosAplicados = Object.keys(limpiar(value)).length > 0;
  const hayBorrador = Object.keys(limpiar(borrador)).length > 0;

  const aplicar = () => {
    if (hayErrores) return;
    onApply(limpiar(borrador));
  };

  const limpiarTodo = () => {
    setBorrador({});
    onApply({});
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        aplicar();
      }}
      aria-label={t('historial.filtros.titulo')}
      className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <label htmlFor={idTabla} className="text-xs font-medium text-[var(--color-text-secondary)]">
            {t('historial.filtros.tabla')}
          </label>
          <AppSelect
            id={idTabla}
            value={borrador.tabla ?? ''}
            onChange={(tabla) => setBorrador((b) => ({ ...b, tabla: tabla || undefined }))}
            options={opcionesTabla}
            disabled={disabled}
            className="w-full"
          />
          {errorTabla && (
            <p role="alert" className="text-xs text-[var(--color-error)]">
              {errorTabla}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor={idUsuario} className="text-xs font-medium text-[var(--color-text-secondary)]">
            {t('historial.filtros.usuario')}
          </label>
          <AppSelect
            id={idUsuario}
            value={borrador.usuarioId ?? ''}
            onChange={(usuarioId) => setBorrador((b) => ({ ...b, usuarioId: usuarioId || undefined }))}
            options={opcionesUsuario}
            disabled={disabled}
            className="w-full"
          />
          {errorUsuario && (
            <p role="alert" className="text-xs text-[var(--color-error)]">
              {errorUsuario}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor={idDesde} className="text-xs font-medium text-[var(--color-text-secondary)]">
            {t('historial.filtros.desde')}
          </label>
          <Input
            id={idDesde}
            type="date"
            value={borrador.desde ?? ''}
            max={borrador.hasta || undefined}
            onChange={(event) => setBorrador((b) => ({ ...b, desde: event.target.value || undefined }))}
            disabled={disabled}
            aria-invalid={errorFechas ? true : undefined}
            aria-describedby={errorFechas ? idErrorFechas : undefined}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor={idHasta} className="text-xs font-medium text-[var(--color-text-secondary)]">
            {t('historial.filtros.hasta')}
          </label>
          <Input
            id={idHasta}
            type="date"
            value={borrador.hasta ?? ''}
            min={borrador.desde || undefined}
            onChange={(event) => setBorrador((b) => ({ ...b, hasta: event.target.value || undefined }))}
            disabled={disabled}
            aria-invalid={errorFechas ? true : undefined}
            aria-describedby={errorFechas ? idErrorFechas : undefined}
          />
        </div>
      </div>

      {errorFechas && (
        <p id={idErrorFechas} role="alert" className="text-xs text-[var(--color-error)]">
          {errorFechas}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={disabled || hayErrores}>
          {t('historial.filtros.aplicar')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={limpiarTodo}
          disabled={disabled || (!hayBorrador && !hayFiltrosAplicados)}
        >
          {t('historial.filtros.limpiar')}
        </Button>
      </div>
    </form>
  );
}
