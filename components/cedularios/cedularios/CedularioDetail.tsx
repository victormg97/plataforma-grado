'use client';

/**
 * Detail view of one cedulario with its tabs (Requirements 2.14, 6.10, 6.13, 11.3, 11.4, 11.7,
 * 11.8, 11.9, 11.10, 11.13, 11.15, 18.1, 18.3, 18.4, 18.10).
 *
 * - Loads the cedulario with `useCedulario`: loading skeleton, error with retry, and "not found /
 *   not visible", which removes `ced_id` and its dependents so the list shows (Requirement 10.11).
 * - Header: back button, universidad logo and name, nombre, versión, descripción, inactive badge
 *   (admin), read-only notice, and the Edit / Delete actions.
 * - Tabs driven by `ced_tab`. Only the active tab's content is mounted. Permisos is for admin and
 *   profesor, Historial for `puedeVerHistorial`; an unavailable tab in the URL falls back to
 *   Estructura.
 * - Permissions come from `usePermisosCedulario`. When the collaborator list is refetched through the
 *   Realtime invalidation and the user lost edit rights, every editor turns read-only.
 */

import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/common/Button';
import { Tabs, tabId, tabPanelId, type TabItem } from '@/components/common/Tabs';
import { cn } from '@/lib/utils';
import { sanitizeDoc, type TiptapDoc } from '@/lib/cedularios/richtext';
import type { CedularioDetalle } from '@/lib/queries/cedularios/cedularios';
import { useCedulariosUrl } from '../hooks/CedulariosUrlContext';
import { CEDULARIO_TABS, esTabValido, type CedulariosTab } from '../hooks/useCedulariosUrlState';
import { codigoDeError } from '../hooks/cedulariosQuery';
import { useCedulario } from '../hooks/useCedularios';
import { useCedularioRealtime } from '../hooks/useCedularioRealtime';
import { useCedulariosAction } from '../hooks/useCedulariosAction';
import { useCedulariosUsuario } from '../hooks/useCedulariosUsuario';
import { useCreadorCedulario, usePermisos } from '../hooks/usePermisos';
import { usePermisosCedulario } from '../hooks/usePermisosCedulario';
import { RichTextField } from '../editor/RichTextField';
import { EnlacesList } from '../enlaces/EnlacesList';
import { EstructuraEditable, useMateriaAcciones } from '../estructura/EstructuraEditable';
import { MateriaPanel } from '../estructura/MateriaPanel';
import { MateriaTree } from '../estructura/MateriaTree';
import { HistorialTab } from '../historial/HistorialTab';
import { PermisosTab } from '../permisos/PermisosTab';
import { AlumnosTab } from '../seguimiento/alumnos-tab/AlumnosTab';
import { UniversidadLogo } from '../universidades/UniversidadLogo';
import { CedularioForm } from './CedularioForm';
import { useEliminarCedularioFlujo } from './DeleteCedularioDialog';
import { idDeModalEditarCedulario, modalEditarCedulario } from './modalCedulario';

const TAB_POR_DEFECTO: CedulariosTab = 'estructura';

export interface CedularioDetailProps {
  cedularioId: string;
}

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

function BotonVolver({ onClick }: { onClick: () => void }) {
  const t = useTranslations('cedularios');
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      icon={<ArrowLeft className="size-4" aria-hidden="true" />}
      onClick={onClick}
    >
      {t('cedularios.volver_cedularios')}
    </Button>
  );
}

function DetalleEsqueleto({ etiqueta }: { etiqueta: string }) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">{etiqueta}</span>
      <div aria-hidden="true" className="flex animate-pulse items-center gap-4">
        <div className="size-14 shrink-0 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)]" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="h-5 w-1/2 rounded bg-[var(--color-bg-secondary)]" />
          <div className="h-3 w-1/4 rounded bg-[var(--color-bg-secondary)]" />
        </div>
      </div>
      <div aria-hidden="true" className="h-10 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
      <div aria-hidden="true" className="h-64 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)]" />
    </div>
  );
}

/** Tree on its own, or tree plus panel side by side from `lg` when a materia is open. */
function DisposicionEstructura({ conPanel, children }: { conPanel: boolean; children: ReactNode }) {
  return <div className={cn('grid gap-4', conPanel && 'lg:grid-cols-2')}>{children}</div>;
}

// ---------------------------------------------------------------------------
// Tab contents
// ---------------------------------------------------------------------------

/** Estructura for users who can edit: editable tree, panel with Edit / Delete, dialogs rendered once. */
function EstructuraEditorTab({ cedularioId }: { cedularioId: string }) {
  const t = useTranslations('cedularios');
  const { materiaId } = useCedulariosUrl();
  const acciones = useMateriaAcciones(cedularioId);
  const { abrirEditar, solicitarEliminar, eliminando } = acciones;

  return (
    <>
      <DisposicionEstructura conPanel={materiaId !== null}>
        <div className="min-w-0">
          <EstructuraEditable cedularioId={cedularioId} acciones={acciones} />
        </div>
        {materiaId !== null && (
          <div className="min-w-0">
            <MateriaPanel
              cedularioId={cedularioId}
              materiaId={materiaId}
              puedeEditar
              extraActions={
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={<Pencil className="size-4" aria-hidden="true" />}
                    aria-label={t('estructura.editar')}
                    onClick={() => abrirEditar(materiaId)}
                  >
                    {t('comun.editar')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 className="size-4" aria-hidden="true" />}
                    aria-label={t('estructura.eliminar')}
                    disabled={eliminando}
                    className="text-[var(--color-error)] hover:text-[var(--color-error)]"
                    onClick={() => solicitarEliminar(materiaId)}
                  >
                    {t('comun.eliminar')}
                  </Button>
                </>
              }
            />
          </div>
        )}
      </DisposicionEstructura>
      {acciones.dialogos}
    </>
  );
}

/** Estructura for read-only users: plain tree and a read-only panel. */
function EstructuraLecturaTab({ cedularioId }: { cedularioId: string }) {
  const { materiaId } = useCedulariosUrl();
  return (
    <DisposicionEstructura conPanel={materiaId !== null}>
      <div className="min-w-0">
        <MateriaTree cedularioId={cedularioId} puedeEditar={false} />
      </div>
      {materiaId !== null && (
        <div className="min-w-0">
          <MateriaPanel cedularioId={cedularioId} materiaId={materiaId} puedeEditar={false} />
        </div>
      )}
    </DisposicionEstructura>
  );
}

/** Stored normativa / rúbrica to a document the editor accepts. `null` is an empty field. */
function docDe(valor: unknown): TiptapDoc | null {
  if (valor === null || valor === undefined) return null;
  return sanitizeDoc(valor, 'sin_tablas');
}

/** Normativa or Rúbrica: rich-text field with autosave, without tables. */
function ContenidoCedularioTab({
  cedulario,
  campo,
  puedeEditar,
}: {
  cedulario: CedularioDetalle;
  campo: 'normativa' | 'rubrica';
  puedeEditar: boolean;
}) {
  const valor = cedulario[campo];
  // Content when the tab opens (the cache already holds what this user saved). Later server
  // versions reach the field through `remoto`.
  const [contenidoInicial] = useState<TiptapDoc | null>(() => docDe(valor));
  // The query keeps the same object between refetches with equal data, so this is referentially stable.
  const remoto = useMemo(() => docDe(valor), [valor]);

  return (
    <RichTextField
      scope={campo === 'normativa' ? 'cedulario-normativa' : 'cedulario-rubrica'}
      recordId={cedulario.id}
      contenidoInicial={contenidoInicial}
      puedeEditar={puedeEditar}
      updatedAt={cedulario.updated_at}
      remoto={remoto}
    />
  );
}

// ---------------------------------------------------------------------------
// Loaded cedulario
// ---------------------------------------------------------------------------

interface CedularioDetailContenidoProps {
  cedulario: CedularioDetalle;
}

function CedularioDetailContenido({ cedulario }: CedularioDetailContenidoProps) {
  const t = useTranslations('cedularios');
  const prefijoIds = useId();
  const usuario = useCedulariosUsuario();
  const { rol, userId, isAdmin, isProfesor, isStaff } = usuario;
  const { tab, q, modal, setCedularioId, setTab, setQ, setModal } = useCedulariosUrl();
  const { solicitarEliminacion, evaluandoId, dialogo } = useEliminarCedularioFlujo();

  // Only admin and profesor can read the collaborator list (RPC and RLS); do not ask for it otherwise.
  const colaboradores = usePermisos(isStaff ? cedulario.id : null);
  const permisos = usePermisosCedulario(cedulario, colaboradores.data);
  const { puedeEditar, puedeGestionar, puedeVerHistorial } = permisos;

  const esCreador = userId !== null && cedulario.created_by === userId;
  // A collaborator is read-only until the list loads, so rights are only "known" afterwards.
  const permisosListos = rol !== null && (isAdmin || esCreador || !isProfesor || !colaboradores.isPending);

  // Edit rights lost while the view is open (the permission list was refetched without this user).
  const [teniaEdicion, setTeniaEdicion] = useState(false);
  const [perdioEdicion, setPerdioEdicion] = useState(false);
  if (puedeEditar !== teniaEdicion) {
    setTeniaEdicion(puedeEditar);
    setPerdioEdicion(!puedeEditar);
  }

  // ---- Tabs ---------------------------------------------------------------
  const tabsDisponibles = useMemo(
    () =>
      CEDULARIO_TABS.filter((clave) => {
        if (clave === 'permisos') return isStaff;
        if (clave === 'alumnos') return isStaff;
        if (clave === 'historial') return puedeVerHistorial;
        return true;
      }),
    [isStaff, puedeVerHistorial],
  );
  const tabEfectiva: CedulariosTab = tabsDisponibles.includes(tab) ? tab : TAB_POR_DEFECTO;

  // Creator name through a DEFINER RPC (profesores cannot read other profiles). Only admin and
  // profesor, and only when the Permisos tab is open; the cache keeps it afterwards.
  const creador = useCreadorCedulario(cedulario.id, { enabled: isStaff && tabEfectiva === 'permisos' });
  const creadorNombre =
    creador.data != null ? `${creador.data.nombre} ${creador.data.apellido}`.trim() : undefined;

  // A tab that this role cannot open is replaced by Estructura in the URL too.
  useEffect(() => {
    if (rol !== null && tab !== tabEfectiva) setTab(TAB_POR_DEFECTO);
  }, [rol, tab, tabEfectiva, setTab]);

  const items = useMemo<TabItem[]>(
    () => tabsDisponibles.map((clave) => ({ key: clave, label: t(`detalle.tabs.${clave}`) })),
    [tabsDisponibles, t],
  );

  const cambiarTab = useCallback(
    (clave: string) => {
      if (!esTabValido(clave)) return;
      // The materias search (ced_q) belongs to the Estructura tab only.
      if (clave !== 'estructura' && q !== '') setQ('');
      setTab(clave);
    },
    [q, setQ, setTab],
  );

  // ---- Edit form (ced_modal) ----------------------------------------------
  const modalEsDeEsteCedulario = idDeModalEditarCedulario(modal) === cedulario.id;
  const formularioAbierto = modalEsDeEsteCedulario && puedeEditar;

  // A shared URL can carry the edit modal for a user who may not edit: close it once rights are known.
  useEffect(() => {
    if (modalEsDeEsteCedulario && permisosListos && !puedeEditar) setModal(null);
  }, [modalEsDeEsteCedulario, permisosListos, puedeEditar, setModal]);

  // ---- Header data --------------------------------------------------------
  const volver = () => {
    // The materias search shares ced_q with the list filter: leave it empty.
    setQ('');
    setCedularioId(null);
  };

  const descripcion = cedulario.descripcion?.trim() ?? '';
  const version = cedulario.version?.trim() ?? '';
  const universidad = cedulario.universidad;
  const mostrarInactivo = isAdmin && !cedulario.activo;

  let aviso: string | null = null;
  if (perdioEdicion) aviso = t('detalle.perdiste_edicion');
  else if (permisosListos && !puedeEditar) aviso = t('detalle.solo_lectura_aviso');

  const panelTab = tabEfectiva;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <BotonVolver onClick={volver} />
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <UniversidadLogo
            url={universidad?.logo_url ?? null}
            nombre={universidad?.nombre ?? ''}
            className="size-14"
          />
          <div className="min-w-0 flex-1 space-y-1">
            {universidad !== null && universidad.nombre !== '' && (
              <p className="truncate text-sm text-[var(--color-text-secondary)]">{universidad.nombre}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="min-w-0 break-words text-xl font-semibold text-[var(--color-text-primary)]">
                {cedulario.nombre}
              </h2>
              {mostrarInactivo && (
                <span className="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-muted)]">
                  {t('cedularios.inactivo')}
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">
              {version !== '' ? t('cedularios.version', { version }) : t('cedularios.sin_version')}
            </p>
            {descripcion !== '' ? (
              <p className="whitespace-pre-line break-words text-sm text-[var(--color-text-secondary)]">
                {descripcion}
              </p>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">{t('detalle.sin_descripcion')}</p>
            )}
          </div>
        </div>

        {(puedeEditar || (puedeGestionar && cedulario.activo)) && (
          <div className="flex shrink-0 flex-wrap items-center gap-2" role="group" aria-label={t('comun.acciones')}>
            {puedeEditar && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Pencil className="size-4" aria-hidden="true" />}
                onClick={() => setModal(modalEditarCedulario(cedulario.id))}
              >
                {t('cedularios.editar')}
              </Button>
            )}
            {puedeGestionar && cedulario.activo && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={<Trash2 className="size-4" aria-hidden="true" />}
                loading={evaluandoId === cedulario.id}
                disabled={evaluandoId !== null}
                className="text-[var(--color-error)] hover:text-[var(--color-error)]"
                onClick={() => void solicitarEliminacion({ id: cedulario.id, nombre: cedulario.nombre })}
              >
                {evaluandoId === cedulario.id ? t('comun.eliminando') : t('cedularios.eliminar')}
              </Button>
            )}
          </div>
        )}
      </header>

      {aviso !== null && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-secondary)]"
        >
          {aviso}
        </p>
      )}

      <Tabs
        items={items}
        active={tabEfectiva}
        onChange={cambiarTab}
        idPrefix={prefijoIds}
        aria-label={t('detalle.tabs_aria')}
      />

      <div
        key={panelTab}
        role="tabpanel"
        id={tabPanelId(prefijoIds, panelTab)}
        aria-labelledby={tabId(prefijoIds, panelTab)}
        className="min-w-0"
      >
        {panelTab === 'estructura' &&
          (puedeEditar ? (
            <EstructuraEditorTab cedularioId={cedulario.id} />
          ) : (
            <EstructuraLecturaTab cedularioId={cedulario.id} />
          ))}
        {panelTab === 'normativa' && (
          <ContenidoCedularioTab key="normativa" cedulario={cedulario} campo="normativa" puedeEditar={puedeEditar} />
        )}
        {panelTab === 'rubrica' && (
          <ContenidoCedularioTab key="rubrica" cedulario={cedulario} campo="rubrica" puedeEditar={puedeEditar} />
        )}
        {panelTab === 'enlaces' && (
          <EnlacesList scope="cedulario" parentId={cedulario.id} puedeEditar={puedeEditar} />
        )}
        {panelTab === 'permisos' && (
          <PermisosTab
            cedularioId={cedulario.id}
            creadorId={cedulario.created_by}
            creadorNombre={creadorNombre}
            puedeGestionar={puedeGestionar}
          />
        )}
        {panelTab === 'historial' && <HistorialTab cedularioId={cedulario.id} />}
        {panelTab === 'alumnos' && <AlumnosTab cedulario={cedulario} />}
      </div>

      {formularioAbierto && (
        <CedularioForm key={cedulario.id} cedularioId={cedulario.id} onClose={() => setModal(null)} />
      )}

      {dialogo}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

/**
 * Detail of the cedulario `cedularioId` (normally `ced_id`). Renders the loading, error and "not
 * found" states itself and mounts the Realtime invalidation channel once.
 */
export function CedularioDetail({ cedularioId }: CedularioDetailProps) {
  const t = useTranslations('cedularios');
  const { translateError } = useCedulariosAction();
  const { modal, clearCedulario, setCedularioId, setModal, setQ } = useCedulariosUrl();
  const consulta = useCedulario(cedularioId);

  // One channel per open cedulario. Remote changes invalidate the queries; the editors receive the
  // refetched documents through their `remoto` prop, so no extra callback is needed.
  useCedularioRealtime(cedularioId);

  const noEncontrado = consulta.isSuccess && consulta.data === null;

  // Missing or invisible cedulario: drop ced_id and its dependents so the list shows (Requirement 10.11).
  useEffect(() => {
    if (!noEncontrado) return;
    if (idDeModalEditarCedulario(modal) === cedularioId) setModal(null);
    clearCedulario();
  }, [noEncontrado, modal, cedularioId, setModal, clearCedulario]);

  if (consulta.isPending) {
    return <DetalleEsqueleto etiqueta={t('detalle.cargando')} />;
  }

  if (consulta.isError && consulta.data === undefined) {
    return (
      <section className="flex flex-col gap-4">
        <div>
          <BotonVolver
            onClick={() => {
              setQ('');
              setCedularioId(null);
            }}
          />
        </div>
        <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {translateError({ code: codigoDeError(consulta.error) })}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={consulta.isFetching}
            onClick={() => void consulta.refetch()}
          >
            {t('comun.reintentar')}
          </Button>
        </div>
      </section>
    );
  }

  if (consulta.data === null || consulta.data === undefined) {
    return (
      <p role="status" className="py-10 text-center text-sm text-[var(--color-text-secondary)]">
        {t('detalle.no_encontrado')}
      </p>
    );
  }

  return <CedularioDetailContenido key={consulta.data.id} cedulario={consulta.data} />;
}
