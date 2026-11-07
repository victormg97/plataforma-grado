'use client';

/**
 * Activity tab of the reviewer (staff only). Lists the audit entries of an assignment,
 * newest first, 50 per page with a "load more" button. Each entry shows the author
 * ("Usuario desconocido" when missing), the date in the `es` locale and a description built
 * from `describirCambio` and the i18n templates. It has an empty state and an error state
 * with a retry action.
 */

import { format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/common/Button';
import { cn } from '@/lib/utils';
import { describirCambio } from '@/lib/cedularios/seguimiento/actividad';
import type { ActividadItem } from '@/lib/queries/cedularios/seguimiento/actividad';
import { useActividad } from '../../hooks/useActividad';

interface ActividadTabProps {
  /** Assignment whose activity is listed. */
  asignacionId: string;
  className?: string;
}

/** Date and time in the `es` locale; an unparsable value falls back to the raw text. */
function formatearFecha(valor: string): string {
  const fecha = parseISO(valor);
  return isValid(fecha) ? format(fecha, "d MMM yyyy, HH:mm", { locale: es }) : valor;
}

export function ActividadTab({ asignacionId, className }: ActividadTabProps) {
  const t = useTranslations('cedularios.seguimiento.actividad');
  const tComun = useTranslations('cedularios.seguimiento.comun');
  const consulta = useActividad(asignacionId);

  const items: ActividadItem[] = consulta.data?.items ?? [];
  const errorSiguientePagina = consulta.isFetchNextPageError;

  const reintentar = () => {
    if (errorSiguientePagina) void consulta.fetchNextPage();
    else void consulta.refetch();
  };

  if (consulta.isPending) {
    return (
      <div role="status" aria-live="polite" className={cn('space-y-3', className)}>
        <span className="sr-only">{tComun('cargando')}</span>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
          />
        ))}
      </div>
    );
  }

  // Initial load failed: nothing to show but the error and the retry action.
  if (consulta.isError && items.length === 0) {
    return (
      <div
        role="alert"
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-error)] p-3',
          className,
        )}
      >
        <p className="text-sm text-[var(--color-error)]">{t('error_carga')}</p>
        <Button type="button" size="sm" variant="secondary" onClick={reintentar}>
          {tComun('reintentar')}
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className={cn('py-10 text-center text-sm text-[var(--color-text-muted)]', className)}>
        {t('vacio')}
      </p>
    );
  }

  return (
    <section aria-labelledby={`actividad-titulo-${asignacionId}`} className={cn('space-y-4', className)}>
      <h3
        id={`actividad-titulo-${asignacionId}`}
        className="text-base font-semibold text-[var(--color-text-primary)]"
      >
        {t('titulo')}
      </h3>

      <ol aria-label={t('lista_aria')} className="divide-y divide-[var(--color-border)]">
        {items.map((item) => {
          const { clave, params } = describirCambio({
            tabla: item.tabla,
            campo: item.campo,
            valorAnterior: item.valorAnterior,
            valorNuevo: item.valorNuevo,
          });
          const autor = item.usuarioNombre?.trim() || t('usuario_desconocido');
          return (
            <li key={item.id} className="py-3">
              <p className="break-words text-sm text-[var(--color-text-primary)]">{t(clave, params)}</p>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                {t('autor_fecha', { autor, fecha: formatearFecha(item.createdAt) })}
              </p>
            </li>
          );
        })}
      </ol>

      {consulta.isError && errorSiguientePagina && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-error)] p-3"
        >
          <p className="text-sm text-[var(--color-error)]">{t('error_carga')}</p>
          <Button type="button" size="sm" variant="secondary" onClick={reintentar}>
            {tComun('reintentar')}
          </Button>
        </div>
      )}

      {consulta.hasNextPage && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={consulta.isFetchingNextPage}
            onClick={() => void consulta.fetchNextPage()}
          >
            {t('cargar_mas')}
          </Button>
        </div>
      )}
    </section>
  );
}
