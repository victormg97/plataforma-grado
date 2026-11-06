'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { puedeVerHistorial } from '@/lib/cedularios/permisos';
import { CEDULARIOS_I18N_NAMESPACE } from '@/lib/cedularios/errors';
import type { HistorialFiltros, HistorialItem as HistorialItemData } from '@/lib/queries/cedularios/historial';
import { codigoDeError } from '../hooks/cedulariosQuery';
import { useCedulariosAction } from '../hooks/useCedulariosAction';
import { useCedulariosUsuario } from '../hooks/useCedulariosUsuario';
import { useHistorial } from '../hooks/useHistorial';
import { HistorialFilters, type HistorialUsuarioOpcion } from './HistorialFilters';
import { HistorialItem } from './HistorialItem';

export interface HistorialTabProps {
  cedularioId: string;
}

/**
 * Historial tab of a cedulario (Requirements 8.10, 8.11, 8.14, 8.15, 11.10, 18.1).
 *
 * The parent mounts it lazily, so the history loads when the tab is opened. It refreshes only
 * through the "Actualizar historial" button: there is no Realtime subscription. Alumno and
 * lector get nothing (the parent already omits the tab; this is a second guard).
 */
export function HistorialTab({ cedularioId }: HistorialTabProps) {
  const { rol } = useCedulariosUsuario();
  if (!rol || !puedeVerHistorial(rol)) return null;
  // `key` resets filters and known users when another cedulario is shown.
  return <HistorialContenido key={cedularioId} cedularioId={cedularioId} />;
}

/** Users seen so far in the loaded entries, by id. */
type UsuariosConocidos = Record<string, string>;

function HistorialContenido({ cedularioId }: HistorialTabProps) {
  const t = useTranslations(CEDULARIOS_I18N_NAMESPACE);
  const { translateError } = useCedulariosAction();

  // Filters currently applied. The filters component only calls `setFiltros` with a valid set,
  // so an invalid range never replaces the list on screen.
  const [filtros, setFiltros] = useState<HistorialFiltros>({});
  const consulta = useHistorial(cedularioId, filtros);
  const items: HistorialItemData[] = consulta.data?.items ?? [];

  // Usuario filter options: authors seen in the entries loaded so far. They accumulate, so
  // filtering by one user does not remove the others from the select. Entries whose author is
  // unknown have no name to offer.
  const [conocidos, setConocidos] = useState<UsuariosConocidos>({});
  const nuevos = items.filter(
    (item) => item.usuarioId && item.usuarioNombre?.trim() && !conocidos[item.usuarioId],
  );
  if (nuevos.length > 0) {
    const siguiente = { ...conocidos };
    for (const item of nuevos) {
      if (item.usuarioId && item.usuarioNombre) siguiente[item.usuarioId] = item.usuarioNombre;
    }
    setConocidos(siguiente);
  }

  const usuarios = useMemo<HistorialUsuarioOpcion[]>(
    () =>
      Object.entries(conocidos)
        .map(([id, nombre]) => ({ id, nombre }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [conocidos],
  );

  const hayFiltros = Boolean(filtros.tabla || filtros.usuarioId || filtros.desde || filtros.hasta);
  const cargandoInicial = consulta.isPending;
  const actualizandoFiltros = consulta.isPlaceholderData;
  const errorSiguientePagina = consulta.isFetchNextPageError;

  const reintentar = () => {
    if (errorSiguientePagina) void consulta.fetchNextPage();
    else void consulta.refetch();
  };

  return (
    <section aria-labelledby="historial-titulo" className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="historial-titulo" className="text-base font-semibold text-[var(--color-text-primary)]">
            {t('historial.titulo')}
          </h3>
          <p className="text-sm text-[var(--color-text-muted)]">{t('historial.descripcion')}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          icon={<RefreshCw />}
          loading={consulta.isRefetching && !consulta.isFetchingNextPage}
          disabled={cargandoInicial}
          onClick={() => void consulta.refetch()}
        >
          {t('historial.actualizar')}
        </Button>
      </header>

      <HistorialFilters value={filtros} usuarios={usuarios} onApply={setFiltros} />

      {cargandoInicial ? (
        <div role="status" aria-live="polite" className="space-y-3">
          <span className="sr-only">{t('historial.cargando')}</span>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
            />
          ))}
        </div>
      ) : (
        <>
          {consulta.isError && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-error)] p-3"
            >
              <p className="text-sm text-[var(--color-error)]">
                {translateError({ code: codigoDeError(consulta.error) })}
              </p>
              <Button type="button" size="sm" variant="secondary" onClick={reintentar}>
                {t('comun.reintentar')}
              </Button>
            </div>
          )}

          {items.length === 0 ? (
            !consulta.isError && (
              <p className="py-10 text-center text-sm text-[var(--color-text-muted)]">
                {hayFiltros ? t('historial.vacio_filtros') : t('historial.vacio')}
              </p>
            )
          ) : (
            <ol
              aria-busy={actualizandoFiltros}
              className={actualizandoFiltros ? 'opacity-60 transition-opacity' : 'transition-opacity'}
            >
              {items.map((item) => (
                <HistorialItem key={item.id} item={item} />
              ))}
            </ol>
          )}

          {consulta.hasNextPage && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={consulta.isFetchingNextPage}
                disabled={actualizandoFiltros}
                onClick={() => void consulta.fetchNextPage()}
              >
                {consulta.isFetchingNextPage ? t('historial.cargando_mas') : t('historial.cargar_mas')}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
