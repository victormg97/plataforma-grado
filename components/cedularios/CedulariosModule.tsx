'use client';

import { useEffect, useMemo } from 'react';
import { BookMarked } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Tabs, tabId, tabPanelId, type TabItem } from '@/components/common/Tabs';
import { CedularioDetail } from './cedularios/CedularioDetail';
import { CedularioList } from './cedularios/CedularioList';
import { CedulariosUrlProvider, useCedulariosUrl } from './hooks/CedulariosUrlContext';
import { useCedulariosUsuario } from './hooks/useCedulariosUsuario';
import { PARAM_UNIVERSIDAD, esVistaValida, type CedulariosVista } from './hooks/useCedulariosUrlState';
import { useUniversidades } from './hooks/useUniversidades';
import { UniversidadList } from './universidades/UniversidadList';

const PREFIJO_IDS = 'ced-vistas';
const VISTAS: readonly CedulariosVista[] = ['universidades', 'cedularios'];

function CedulariosSkeleton({ etiqueta }: { etiqueta: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={etiqueta} className="flex animate-pulse flex-col gap-3">
      <div className="h-10 w-1/2 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)]" />
      <div className="h-24 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)]" />
    </div>
  );
}

/**
 * Chooses the level to render from the `ced_` URL state (Requirements 10.7, 10.8, 10.10, 11.1, 11.2):
 * `ced_id` set -> detail; else `ced_uni` set -> cedularios of that universidad; else the root level,
 * which offers the universidades and a view with every cedulario (`ced_vista`).
 *
 * Mounted only once the role is known. A `ced_uni` that is not among the visible universidades is
 * removed together with its dependents so the universidades level is shown (Requirement 10.11).
 * `ced_id` and `ced_materia` are validated by `CedularioDetail` and `MateriaPanel`.
 */
function CedulariosContenido() {
  const t = useTranslations('cedularios');
  const usuario = useCedulariosUsuario();
  const { universidadId, cedularioId, vista, setVista, clearInvalid } = useCedulariosUrl();
  const universidadesQuery = useUniversidades();

  // Only a settled, successful load can prove that the record is missing: not while loading, not
  // while refetching possibly stale data, and not after an error.
  const universidadInvalida =
    universidadId !== null &&
    universidadesQuery.isSuccess &&
    !universidadesQuery.isFetching &&
    !universidadesQuery.data.some((u) => u.id === universidadId && (usuario.isAdmin || u.activo));

  useEffect(() => {
    if (universidadInvalida) clearInvalid(PARAM_UNIVERSIDAD);
  }, [universidadInvalida, clearInvalid]);

  const items = useMemo<TabItem[]>(
    () => VISTAS.map((clave) => ({ key: clave, label: t(`${clave}.titulo`) })),
    [t],
  );

  if (cedularioId !== null) return <CedularioDetail cedularioId={cedularioId} />;
  if (universidadId !== null && !universidadInvalida) return <CedularioList />;

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        items={items}
        active={vista}
        onChange={(clave) => {
          if (esVistaValida(clave)) setVista(clave);
        }}
        idPrefix={PREFIJO_IDS}
        aria-label={t('seccion.vistas_aria')}
      />
      <div role="tabpanel" id={tabPanelId(PREFIJO_IDS, vista)} aria-labelledby={tabId(PREFIJO_IDS, vista)}>
        {vista === 'cedularios' ? <CedularioList /> : <UniversidadList />}
      </div>
    </div>
  );
}

/**
 * Cedularios section of the Programas pages (Requirements 10.1, 10.5 to 10.8, 10.10, 10.11, 11.1,
 * 11.2, 11.15). Takes no props. The role comes from the current-user hook through
 * `useCedulariosUsuario`; alumno and lector get the read-only experience from the child components.
 *
 * `CedulariosUrlProvider` is mounted here, once, so every child shares one copy of the `ced_` URL
 * state. Query params without the `ced_` prefix are never touched.
 */
export function CedulariosModule() {
  const t = useTranslations('cedularios');
  const usuario = useCedulariosUsuario();

  return (
    <CedulariosUrlProvider>
      <section
        aria-labelledby="cedularios-seccion-titulo"
        className="mt-[var(--space-lg)] flex flex-col gap-4 border-t border-[var(--color-border)] pt-[var(--space-lg)]"
      >
        <header className="flex items-start gap-3">
          <BookMarked className="mt-1 size-5 shrink-0 text-[var(--color-brand-gold)]" aria-hidden="true" />
          <div className="min-w-0">
            <h2
              id="cedularios-seccion-titulo"
              className="text-xl font-semibold text-[var(--color-text-primary)]"
            >
              {t('seccion.titulo')}
            </h2>
            <p className="text-sm text-[var(--color-text-muted)]">{t('seccion.subtitulo')}</p>
          </div>
        </header>

        {usuario.rol === null ? <CedulariosSkeleton etiqueta={t('comun.cargando')} /> : <CedulariosContenido />}
      </section>
    </CedulariosUrlProvider>
  );
}
