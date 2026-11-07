'use client';

/**
 * "Alumnos" tab of a cedulario (Req 16.2 to 16.11, 25.8).
 * Lists the students with an active assignment of the cedulario, 50 per page with a
 * "load more" action, and a search box. The search text is debounced (300 ms), trimmed and
 * capped at 100 characters inside `useAlumnosDeCedulario`, so this component passes the raw text.
 * "Asignar alumnos" opens `seg_modal=asignar` with the cedulario fixed and is shown only to
 * staff. Realtime signals of the assignments of this cedulario refresh the list.
 */

import { useId, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/common/Button';
import { SEG_BUSQUEDA_MAX } from '@/lib/cedularios/seguimiento/constants';
import type { CedularioDetalle } from '@/lib/queries/cedularios/cedularios';
import { useAlumnosDeCedulario } from '../hooks/useAlumnosDeCedulario';
import { useCedularioAsignacionesRealtime } from '../hooks/useCedularioAsignacionesRealtime';
import { useSegRol } from '../hooks/useSegRol';
import { useSegUrl } from '../url/useSegUrl';
import { AlumnoAsignacionFila } from './AlumnoAsignacionFila';

export interface AlumnosTabProps {
  cedulario: Pick<CedularioDetalle, 'id' | 'nombre'>;
}

export function AlumnosTab({ cedulario }: AlumnosTabProps) {
  const t = useTranslations('cedularios.seguimiento');
  const tituloId = useId();
  const { isStaff } = useSegRol();
  const { abrir } = useSegUrl();
  const [texto, setTexto] = useState('');

  const consulta = useAlumnosDeCedulario(cedulario.id, texto);
  useCedularioAsignacionesRealtime(cedulario.id);

  const filas = consulta.data?.filas ?? [];
  const total = consulta.data?.total ?? 0;
  const cargandoInicial = consulta.isPending;
  const buscando = consulta.isPlaceholderData;
  const hayBusqueda = texto.trim() !== '';
  const errorInicial = consulta.isError && !consulta.data;
  const soloLectura = filas.length > 0 && filas.every((fila) => !fila.puedeEditar);

  const asignar = () => {
    abrir({ modal: 'asignar', cedulario: cedulario.id });
  };

  const botonAsignar = isStaff ? (
    <Button type="button" size="sm" icon={<UserPlus className="size-4" aria-hidden="true" />} onClick={asignar}>
      {t('alumnos_tab.asignar_alumnos')}
    </Button>
  ) : null;

  return (
    <section aria-labelledby={tituloId} className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={tituloId} className="text-base font-semibold text-[var(--color-text-primary)]">
            {t('alumnos_tab.titulo')}
          </h3>
          <p className="text-sm text-[var(--color-text-muted)]">{t('alumnos_tab.descripcion')}</p>
        </div>
        {botonAsignar}
      </header>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-muted)]"
          aria-hidden="true"
        />
        <input
          type="search"
          value={texto}
          maxLength={SEG_BUSQUEDA_MAX}
          onChange={(event) => setTexto(event.target.value)}
          placeholder={t('alumnos_tab.buscar_placeholder')}
          aria-label={t('alumnos_tab.buscar_aria')}
          className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] pl-9 pr-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]"
        />
      </div>

      {cargandoInicial && (
        <div role="status" aria-live="polite" className="space-y-3">
          <span className="sr-only">{t('comun.cargando')}</span>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              aria-hidden="true"
              className="h-16 animate-pulse rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
            />
          ))}
        </div>
      )}

      {errorInicial && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-error)] p-3"
        >
          <p className="text-sm text-[var(--color-error)]">{t('alumnos_tab.error_carga')}</p>
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
      )}

      {!cargandoInicial && !errorInicial && filas.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-4 py-10 text-center">
          {hayBusqueda ? (
            <p className="text-sm text-[var(--color-text-muted)]">{t('alumnos_tab.vacio_busqueda')}</p>
          ) : (
            <>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                {t('alumnos_tab.vacio_titulo')}
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {t('alumnos_tab.vacio_descripcion')}
              </p>
              {botonAsignar}
            </>
          )}
        </div>
      )}

      {!cargandoInicial && filas.length > 0 && (
        <>
          <p className="text-xs text-[var(--color-text-muted)]" aria-live="polite">
            {t('alumnos_tab.total', { count: total })}
          </p>
          {soloLectura && (
            <p className="text-xs text-[var(--color-text-muted)]">{t('alumnos_tab.solo_lectura')}</p>
          )}
          <ul
            aria-label={t('alumnos_tab.lista_aria')}
            aria-busy={buscando}
            className={
              buscando
                ? 'divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)] opacity-60 transition-opacity'
                : 'divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)] transition-opacity'
            }
          >
            {filas.map((fila) => (
              <AlumnoAsignacionFila
                key={fila.asignacionId}
                alumno={fila}
                cedularioId={cedulario.id}
                cedularioNombre={cedulario.nombre}
              />
            ))}
          </ul>

          {consulta.isError && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-error)] p-3"
            >
              <p className="text-sm text-[var(--color-error)]">{t('alumnos_tab.error_carga')}</p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                loading={consulta.isFetching}
                onClick={() =>
                  void (consulta.isFetchNextPageError ? consulta.fetchNextPage() : consulta.refetch())
                }
              >
                {t('comun.reintentar')}
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
                disabled={buscando}
                onClick={() => void consulta.fetchNextPage()}
              >
                {consulta.isFetchingNextPage ? t('comun.cargando') : t('comun.cargar_mas')}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
