'use client';

/**
 * Reviewer of the tracking of one student in one cedulario (container).
 *
 * Composes the header, cedulario selector, toolbar, tree, detail panel, "Avance" and
 * "Actividad" tabs (staff only), the "unassigned materias" notice, the empty state and the
 * archived / deactivated sections. It owns no business rules: it loads the data, runs the pure
 * domain functions and passes the results down.
 *
 * Data
 * - The summary of the student (`useResumenAlumno`) gives the assignment, `puedeEditar` and the
 *   header. The materia structure of phase 1 (`useMateriasTree`) and the progress list
 *   (`useProgresoAsignacion`) load in parallel, as two flat requests, once the assignment is known.
 * - Roles come from `clasificarMaterias`; filter and search from `aplicarFiltroYBusqueda`;
 *   percentages from `construirAgregados` over the whole list (never filtered).
 * - Expanding and collapsing the tree is local state in `SeguimientoArbol` (no requests).
 *
 * Mode
 * - `modoRevisor` decides edit or read mode. `modo="lectura"` forces read mode. `puedeEditar`
 *   is refreshed with the summary, so a professor who stops being the owner of the student drops
 *   to read mode after the next refetch. The editable flag changes but nothing remounts, so the
 *   unsaved text of the open forms stays visible and is never sent.
 * - When the assignment is unassigned (realtime signal, or it is no longer listed), staff see the
 *   header notice and read mode; the student sees that the cedulario is no longer assigned and the
 *   reviewer calls `onCerrar`.
 *
 * Escape
 * - `onCapaPropiaChange` reports whether the content has a layer of its own open (today the
 *   detail panel). The host feeds it to `SeguimientoOverlay` as `ownLayerOpen`.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ListPlus, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/common/Button';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { Tabs, tabId, tabPanelId, type TabItem } from '@/components/common/Tabs';
import { useMateriasTree } from '@/components/cedularios/hooks/useMaterias';
import { cn } from '@/lib/utils';
import { agregadoGlobal, construirAgregados } from '@/lib/cedularios/seguimiento/agregados';
import { clasificarMaterias } from '@/lib/cedularios/seguimiento/arbol';
import { estadoVisual } from '@/lib/cedularios/seguimiento/cascada';
import { aplicarFiltroYBusqueda } from '@/lib/cedularios/seguimiento/filtros';
import { modoRevisor } from '@/lib/cedularios/seguimiento/permisos';
import { calcularPorcentaje } from '@/lib/cedularios/seguimiento/porcentaje';
import type {
  AsignacionResumen,
  ResumenAlumno,
} from '@/lib/queries/cedularios/seguimiento/resumen';
import { useAsignacionRealtime } from '../hooks/useAsignacionRealtime';
import { useCascadaCobertura } from '../hooks/useCascadaCobertura';
import { useProgresoAsignacion } from '../hooks/useProgresoAsignacion';
import { useResumenAlumno } from '../hooks/useResumenAlumno';
import { useSegRol } from '../hooks/useSegRol';
import { useSegUrl } from '../url/useSegUrl';
import { MateriaDetallePanel } from './detalle/MateriaDetallePanel';
import { EstadoVacioRevision } from './EstadoVacioRevision';
import { ActividadTab } from './extras/ActividadTab';
import { MateriasArchivadasSection } from './extras/MateriasArchivadasSection';
import { MateriasDesactivadasSection } from './extras/MateriasDesactivadasSection';
import { IndicadorSinAsignar } from './IndicadorSinAsignar';
import { RevisionCabecera } from './RevisionCabecera';
import { RevisionToolbar } from './RevisionToolbar';
import { SeguimientoArbol } from './SeguimientoArbol';

export interface RevisionCedularioAlumnoProps {
  alumnoId: string;
  /** Cedulario to review. `null` opens the first active assignment of the student. */
  cedularioId: string | null;
  /** 'auto': edit when the server allows it and the assignment is active. 'lectura': always read only. */
  modo: 'auto' | 'lectura';
  /** 'overlay': inside the host dialog. 'embebida': inside a page (student view). */
  variante: 'overlay' | 'embebida';
  /** Closes the reviewer (host or page decides what that means). */
  onCerrar?: () => void;
  /** Reports whether the content has a layer of its own open, so Escape closes that layer first. */
  onCapaPropiaChange?: (abierta: boolean) => void;
}

type Pestana = 'avance' | 'actividad';

// ---------------------------------------------------------------------------
// Small state blocks
// ---------------------------------------------------------------------------

function EstadoCarga({ etiqueta, className }: { etiqueta: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center justify-center gap-2 px-4 py-10 text-sm text-[var(--color-text-muted)]',
        className,
      )}
    >
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      <span>{etiqueta}</span>
    </div>
  );
}

function Aviso({ children, className }: { children: string; className?: string }) {
  return (
    <p
      role="status"
      className={cn(
        'rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]',
        className,
      )}
    >
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Container
// ---------------------------------------------------------------------------

export function RevisionCedularioAlumno(props: RevisionCedularioAlumnoProps) {
  // `key` resets the local state (last known assignment, tab, panel layer) for another
  // student or cedulario.
  return (
    <RevisionContenido key={`${props.alumnoId}|${props.cedularioId ?? ''}`} {...props} />
  );
}

function RevisionContenido({
  alumnoId,
  cedularioId,
  modo,
  variante,
  onCerrar,
  onCapaPropiaChange,
}: RevisionCedularioAlumnoProps) {
  const t = useTranslations('cedularios.seguimiento.revision');
  const tComun = useTranslations('cedularios.seguimiento.comun');
  const { estado, fijar, abrir } = useSegUrl();
  const { rol, isAdmin, isStaff } = useSegRol();
  const idPestanas = useId();

  const [pestana, setPestana] = useState<Pestana>('avance');
  const [ownLayerOpen, setOwnLayerOpen] = useState(false);
  const [ultima, setUltima] = useState<AsignacionResumen | null>(null);
  const [senalDesasignada, setSenalDesasignada] = useState(false);
  const [huboEdicion, setHuboEdicion] = useState(false);

  // ── Assignment (summary of the student) ───────────────────────────────────
  const resumenQuery = useResumenAlumno(alumnoId);
  const resumen: ResumenAlumno | null = resumenQuery.data ?? null;

  const objetivoId = cedularioId ?? ultima?.cedularioId ?? null;
  const encontrada = useMemo<AsignacionResumen | null>(() => {
    if (!resumen) return null;
    if (objetivoId) return resumen.asignaciones.find((a) => a.cedularioId === objetivoId) ?? null;
    return resumen.asignaciones.find((a) => a.estado === 'activa') ?? null;
  }, [resumen, objetivoId]);

  // Remember the last assignment seen: once it is unassigned the summary stops listing it.
  if (encontrada && encontrada !== ultima) setUltima(encontrada);

  const asignacion = useMemo<AsignacionResumen | null>(() => {
    const base = encontrada ?? ultima;
    if (!base) return null;
    const desaparecio = resumen !== null && encontrada === null;
    const inactiva = base.estado === 'desasignada' || desaparecio || senalDesasignada;
    return inactiva && base.estado !== 'desasignada'
      ? { ...base, estado: 'desasignada' }
      : base;
  }, [encontrada, ultima, resumen, senalDesasignada]);

  const inactiva = asignacion?.estado === 'desasignada';
  const asignacionId = asignacion?.asignacionId ?? null;
  const noDisponible = asignacion !== null && !asignacion.cedularioActivo && !isAdmin;
  const cargarDatos = asignacion !== null && !noDisponible && !(inactiva && rol === 'alumno');

  const alDesasignar = useCallback(() => setSenalDesasignada(true), []);
  useAsignacionRealtime(asignacionId, { onDesasignada: alDesasignar });

  // ── Mode ──────────────────────────────────────────────────────────────────
  const modoEfectivo =
    modo === 'lectura' || rol === null
      ? 'lectura'
      : modoRevisor({
          rol,
          puedeEditar: resumen?.puedeEditar ?? false,
          asignacionActiva: asignacion !== null && !inactiva,
        });
  const editable = modoEfectivo === 'edicion';

  // Adjusting state while rendering: remember that this session could edit.
  if (editable && !huboEdicion) setHuboEdicion(true);
  const perdioEdicion = huboEdicion && !editable && isStaff && !inactiva && modo === 'auto';

  // ── Tree and progress (two flat requests, in parallel) ────────────────────
  const arbolQuery = useMateriasTree(cargarDatos ? (asignacion?.cedularioId ?? null) : null);
  const progresoQuery = useProgresoAsignacion(asignacionId, { enabled: cargarDatos });

  const flat = useMemo(() => arbolQuery.data ?? [], [arbolQuery.data]);
  const filasProgreso = useMemo(() => progresoQuery.data ?? [], [progresoQuery.data]);
  const datosListos = arbolQuery.isSuccess && progresoQuery.isSuccess;
  const datosCargando = !datosListos && !arbolQuery.isError && !progresoQuery.isError;
  const datosConError =
    (arbolQuery.isError && !arbolQuery.data) || (progresoQuery.isError && !progresoQuery.data);

  const roles = useMemo(() => clasificarMaterias(flat, filasProgreso), [flat, filasProgreso]);
  const filtro = useMemo(
    () =>
      aplicarFiltroYBusqueda({
        flat,
        progreso: filasProgreso,
        roles,
        filtro: estado.filtro,
        q: estado.q,
      }),
    [flat, filasProgreso, roles, estado.filtro, estado.q],
  );
  // Aggregates over the whole list: filter and search never change a percentage.
  const agregados = useMemo(() => construirAgregados(flat, filasProgreso), [flat, filasProgreso]);
  const global = useMemo(() => agregadoGlobal(agregados, flat), [agregados, flat]);

  const totalAsignadas = useMemo(() => {
    let total = 0;
    for (const rolMateria of roles.values()) if (rolMateria === 'asignada') total += 1;
    return total;
  }, [roles]);
  const sinAsignar = useMemo(
    () => flat.filter((nodo) => nodo.activo && roles.get(nodo.id) !== 'asignada').length,
    [flat, roles],
  );

  // The header follows the loaded data, so a check shows in the percentage right away.
  const asignacionVista = useMemo<AsignacionResumen | null>(() => {
    if (!asignacion) return null;
    if (!datosListos) return asignacion;
    return {
      ...asignacion,
      totalAsignadas: global.total,
      totalCubiertas: global.cubiertas,
      porcentaje: calcularPorcentaje(global.cubiertas, global.total),
    };
  }, [asignacion, datosListos, global]);

  const resumenCabecera = useMemo<ResumenAlumno | null>(() => {
    if (!resumen || !asignacionVista) return null;
    const lista = resumen.asignaciones.some((a) => a.asignacionId === asignacionVista.asignacionId)
      ? resumen.asignaciones.map((a) =>
          a.asignacionId === asignacionVista.asignacionId ? asignacionVista : a,
        )
      : [...resumen.asignaciones, asignacionVista];
    return { ...resumen, asignaciones: lista };
  }, [resumen, asignacionVista]);

  // ── Own layer (detail panel) reported to the host ─────────────────────────
  const onCapaRef = useRef(onCapaPropiaChange);
  const onCerrarRef = useRef(onCerrar);
  useEffect(() => {
    onCapaRef.current = onCapaPropiaChange;
    onCerrarRef.current = onCerrar;
  });
  // ── Parent / child coverage (one batch per click) ─────────────────────────
  const cascada = useCascadaCobertura(asignacionId ?? '', flat);
  const confirmandoCascada = cascada.confirmacion !== null;

  useEffect(() => {
    onCapaRef.current?.(ownLayerOpen || confirmandoCascada);
  }, [ownLayerOpen, confirmandoCascada]);
  useEffect(() => {
    return () => onCapaRef.current?.(false);
  }, []);

  // ── Student: the assignment was removed, tell them and close ──────────────
  const esAlumno = rol === 'alumno';
  const mensajeDesasignadaAlumno = t('asignacion_desasignada_alumno');
  useEffect(() => {
    if (!inactiva || !esAlumno) return;
    toast.info(mensajeDesasignadaAlumno);
    onCerrarRef.current?.();
  }, [inactiva, esAlumno, mensajeDesasignadaAlumno]);

  const cerrarPanel = useCallback(() => fijar({ materia: null }), [fijar]);
  const abrirDetalle = useCallback((materiaId: string) => fijar({ materia: materiaId }), [fijar]);

  const reintentarDatos = () => {
    if (arbolQuery.isError) void arbolQuery.refetch();
    if (progresoQuery.isError) void progresoQuery.refetch();
  };

  // ── Rendering ─────────────────────────────────────────────────────────────
  const esOverlay = variante === 'overlay';
  const contenedor = cn(
    'flex flex-col gap-4',
    esOverlay && 'min-h-0 flex-1 overflow-y-auto p-4 sm:p-6',
  );

  const botonCerrar = onCerrar ? (
    <Button type="button" size="sm" variant="secondary" onClick={onCerrar}>
      {tComun('cerrar')}
    </Button>
  ) : null;

  if (resumenQuery.isPending) {
    return (
      <section aria-label={t('titulo')} aria-busy="true" className={contenedor}>
        <EstadoCarga etiqueta={tComun('cargando')} />
      </section>
    );
  }

  if (resumenQuery.isError && !resumen) {
    return (
      <section aria-label={t('titulo')} className={contenedor}>
        <EstadoErrorConAccion
          mensaje={t('error_carga')}
          reintentar={tComun('reintentar')}
          cargando={resumenQuery.isFetching}
          onReintentar={() => void resumenQuery.refetch()}
        />
      </section>
    );
  }

  if (!resumen || !asignacionVista || !resumenCabecera) {
    return (
      <section aria-label={t('titulo')} className={contenedor}>
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <p role="status" className="text-sm text-[var(--color-text-muted)]">
            {t('asignacion_no_encontrada')}
          </p>
          {botonCerrar}
        </div>
      </section>
    );
  }

  // The student no longer has this cedulario: message only (the reviewer is closing).
  if (inactiva && esAlumno) {
    return (
      <section aria-label={t('titulo')} className={contenedor}>
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <p role="status" className="text-sm text-[var(--color-text-primary)]">
            {mensajeDesasignadaAlumno}
          </p>
          {botonCerrar}
        </div>
      </section>
    );
  }

  const pestanaActiva: Pestana = isStaff ? pestana : 'avance';
  const items: TabItem[] = [{ key: 'avance', label: t('tabs.avance') }];
  if (isStaff) items.push({ key: 'actividad', label: t('tabs.actividad') });
  const conPestanas = items.length > 1;

  const materiaAbierta = estado.materia;
  const mostrarPanel = pestanaActiva === 'avance' && materiaAbierta !== null && datosListos;
  const materiaDetalle = materiaAbierta ? flat.find((nodo) => nodo.id === materiaAbierta) : undefined;
  const progresoDetalle = materiaAbierta
    ? filasProgreso.find((fila) => fila.materiaId === materiaAbierta)
    : undefined;
  const agregadoDetalle = materiaAbierta ? agregados.get(materiaAbierta) : undefined;

  const accionEditarMaterias = () =>
    abrir({ modal: 'editar_materias', alumno: alumnoId, cedulario: asignacionVista.cedularioId });

  const cuerpoAvance = noDisponible ? (
    <p
      role="alert"
      className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-6 text-center text-sm text-[var(--color-text-muted)]"
    >
      {t('cedulario_no_disponible')}
    </p>
  ) : datosConError ? (
    <EstadoErrorConAccion
      mensaje={t('error_carga')}
      reintentar={tComun('reintentar')}
      cargando={arbolQuery.isFetching || progresoQuery.isFetching}
      onReintentar={reintentarDatos}
    />
  ) : datosCargando ? (
    <EstadoCarga etiqueta={tComun('cargando')} />
  ) : (
    <div className={cn('grid gap-4', mostrarPanel && 'md:grid-cols-2')}>
      <div className={cn('min-w-0 space-y-3', mostrarPanel && 'hidden md:block')}>
        {editable && totalAsignadas > 0 && sinAsignar > 0 && (
          <IndicadorSinAsignar
            cantidad={sinAsignar}
            alumnoId={alumnoId}
            cedularioId={asignacionVista.cedularioId}
          />
        )}
        {editable && totalAsignadas > 0 && sinAsignar === 0 && (
          // The notice carries this action when there are unassigned materias; the empty
          // state carries it when nothing is assigned. Otherwise it lives here.
          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<ListPlus className="size-4" aria-hidden="true" />}
              onClick={accionEditarMaterias}
            >
              {t('editar_materias')}
            </Button>
          </div>
        )}

        {totalAsignadas === 0 ? (
          <EstadoVacioRevision
            editable={editable}
            alumnoId={alumnoId}
            cedularioId={asignacionVista.cedularioId}
          />
        ) : (
          <>
            <RevisionToolbar total={filtro.total} />
            <SeguimientoArbol
              asignacionId={asignacionVista.asignacionId}
              flat={flat}
              progreso={filasProgreso}
              roles={roles}
              filtro={filtro}
              consulta={estado.q.trim()}
              editable={editable}
              materiaSeleccionadaId={materiaAbierta}
              onAbrirDetalle={abrirDetalle}
              onAlternarCobertura={cascada.alternar}
            />
          </>
        )}

        {editable && (
          <>
            <MateriasArchivadasSection
              asignacionId={asignacionVista.asignacionId}
              alumnoId={alumnoId}
              cedularioId={asignacionVista.cedularioId}
              materias={flat}
              progreso={filasProgreso}
            />
            <MateriasDesactivadasSection
              asignacionId={asignacionVista.asignacionId}
              enabled={isStaff}
            />
          </>
        )}
      </div>

      {mostrarPanel && (
        <MateriaDetallePanel
          asignacionId={asignacionVista.asignacionId}
          materia={materiaDetalle}
          progreso={progresoDetalle}
          datosListos={datosListos}
          editable={editable}
          estadoCobertura={estadoVisual(agregadoDetalle)}
          esRama={(agregadoDetalle?.total ?? 0) > 1}
          onAlternarCobertura={cascada.alternar}
          guardandoCobertura={cascada.guardando}
          onCerrar={cerrarPanel}
          onCapaPropiaChange={setOwnLayerOpen}
          className="min-w-0 md:max-h-[70vh]"
        />
      )}
    </div>
  );

  return (
    <section aria-label={t('titulo')} className={contenedor}>
      {/*
        The overlay container is a fixed-height flex column with overflow-y-auto. The tab bar is a
        scroll container (overflow-x-auto), so its automatic min-height is 0 and, once the content
        grows (expanded tree, activity list), flex shrinks it to nothing. `shrink-0` on the direct
        children keeps them at their natural height; the container scrolls instead.
      */}
      <RevisionCabecera
        resumen={resumenCabecera}
        asignacion={asignacionVista}
        className={cn('shrink-0', esOverlay && 'pr-8')}
      />

      {perdioEdicion && <Aviso className="shrink-0">{t('perdiste_edicion')}</Aviso>}
      {!editable && !perdioEdicion && !inactiva && esOverlay && (
        <Aviso className="shrink-0">{t('modo_lectura_aviso')}</Aviso>
      )}

      {conPestanas && (
        <Tabs
          className="shrink-0"
          items={items}
          active={pestanaActiva}
          onChange={(clave) => setPestana(clave === 'actividad' ? 'actividad' : 'avance')}
          idPrefix={idPestanas}
          aria-label={t('tabs_aria')}
        />
      )}

      <div
        role={conPestanas ? 'tabpanel' : undefined}
        id={conPestanas ? tabPanelId(idPestanas, pestanaActiva) : undefined}
        aria-labelledby={conPestanas ? tabId(idPestanas, pestanaActiva) : undefined}
        className="min-w-0"
      >
        {pestanaActiva === 'actividad' ? (
          <ActividadTab asignacionId={asignacionVista.asignacionId} />
        ) : (
          cuerpoAvance
        )}
      </div>

      <ConfirmModal
        open={confirmandoCascada}
        onClose={cascada.cancelar}
        onConfirm={cascada.confirmar}
        title={t('cascada.desmarcar_titulo')}
        description={t('cascada.desmarcar_descripcion', {
          count: cascada.confirmacion?.perdidas ?? 0,
        })}
        confirmText={t('cascada.desmarcar_confirmar')}
        cancelText={t('cascada.desmarcar_cancelar')}
        contentClassName="z-[80]"
        isDanger
      />
    </section>
  );
}

/** Error block with a retry action that runs `onReintentar`. */
function EstadoErrorConAccion({
  mensaje,
  reintentar,
  cargando,
  onReintentar,
}: {
  mensaje: string;
  reintentar: string;
  cargando: boolean;
  onReintentar: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-error)] p-3"
    >
      <p className="text-sm text-[var(--color-error)]">{mensaje}</p>
      <Button type="button" size="sm" variant="secondary" loading={cargando} onClick={onReintentar}>
        {reintentar}
      </Button>
    </div>
  );
}
