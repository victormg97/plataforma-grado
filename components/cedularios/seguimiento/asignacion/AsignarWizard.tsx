'use client';

/**
 * Wizard of the assign dialog (content of the tracking overlay: header, body and footer).
 *
 * Steps (see `asignacion-wizard.ts` for the rules):
 * - Student fixed (`alumno`): 1 pick cedularios, 2 pick materias of each one, 3 confirm.
 * - Cedulario fixed (`cedulario`): 1 pick students, 2 pick materias, 3 confirm.
 * - Reassign (`reasignar`): 2 pick materias (previous ones preselected), 3 confirm.
 *
 * All the choices live in one state object, so going back never loses anything. Saving does not
 * happen before the confirm step. The dialog reports whether there is progress to lose
 * (`onProgresoChange`), so the host asks before closing; the wizard never closes while saving.
 */

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { cn } from '@/lib/utils';
import { useCedularios } from '@/components/cedularios/hooks/useCedularios';
import { seguimientoKeys } from '@/lib/cedularios/seguimiento/keys';
import {
  construirEnvio,
  hayProgreso,
  materiasPorDefecto,
  pasoAnterior,
  pasoInicial,
  pasoSiguiente,
  pasosDelModo,
  puedeAvanzar,
  resumirResultados,
  sincronizarMaterias,
  type EstadoWizard,
  type ModoWizard,
  type PasoWizard,
  type ResultadoAsignacionCedulario,
  type SeleccionMaterias,
} from '@/lib/cedularios/seguimiento/asignacion-wizard';
import type { AlumnoResumen } from '@/lib/queries/cedularios/seguimiento/resumen';
import type { AlumnoAsignable } from '@/lib/queries/cedularios/seguimiento/asignables';
import type { ResultadoAsignacionAlumno } from '@/app/actions/cedularios/seguimiento/asignaciones';
import { mostrarExitoSeguimiento } from '../hooks/segInvalidaciones';
import { useAsignarCedulario } from '../hooks/useAsignarCedulario';
import { useAsignarCedularios } from '../hooks/useAsignarCedularios';
import { AlumnosSelector } from './AlumnosSelector';
import { CedulariosMultiSelector } from './CedulariosMultiSelector';
import { MateriasSelector } from './MateriasSelector';
import { ResultadoAsignacion } from './ResultadoAsignacion';
import { ResultadoCedularios } from './ResultadoCedularios';

export type Bloqueo = 'inactivo' | 'sin_permisos' | 'ya_asignado';

export interface CedularioFijo {
  id: string;
  nombre: string;
}

export interface AsignarWizardProps {
  modo: ModoWizard;
  cedularioFijo: CedularioFijo | null;
  alumnoFijo: AlumnoResumen | null;
  bloqueo: Bloqueo | null;
  /** Cedulario ids the fixed student already has with an active assignment. */
  idsAsignados: readonly string[];
  /** Materias preselected in reassign mode (the ones assigned before). */
  materiasIniciales: SeleccionMaterias;
  conAvance: ReadonlySet<string>;
  /** Force close (after a successful save, from the result view, from the blocked notice). */
  onCerrar: () => void;
  /** Close requested by the user (Cancel): the host asks first when there is progress. */
  onSolicitarCierre: () => void;
  /** True while there is something the user would lose by closing. */
  onProgresoChange?: (hayProgreso: boolean) => void;
  /** True while the wizard has its own layer open (a save in flight, the unmark confirmation). */
  onCapaPropiaChange?: (abierta: boolean) => void;
}

type ResultadoVista =
  | { tipo: 'alumnos'; filas: ResultadoAsignacionAlumno[]; nombres: Record<string, string> }
  | { tipo: 'cedularios'; filas: ResultadoAsignacionCedulario[] };

function nombreCompleto(partes: readonly (string | null | undefined)[]): string {
  return partes
    .map((parte) => (parte ?? '').trim())
    .filter((parte) => parte !== '')
    .join(' ');
}

/** Names of the selected students, read from the selector pages already in the cache. */
function nombresDeSeleccionados(
  qc: ReturnType<typeof useQueryClient>,
  cedularioId: string,
  alumnoIds: readonly string[],
): Record<string, string> {
  const buscados = new Set(alumnoIds);
  const nombres: Record<string, string> = {};
  const entradas = qc.getQueriesData<InfiniteData<AlumnoAsignable[]>>({
    queryKey: [...seguimientoKeys.all, 'asignables', cedularioId],
  });
  for (const [, data] of entradas) {
    for (const pagina of data?.pages ?? []) {
      for (const alumno of pagina) {
        if (!buscados.has(alumno.id) || alumno.id in nombres) continue;
        nombres[alumno.id] = nombreCompleto([alumno.nombre, alumno.apellido, alumno.apellidoMaterno]);
      }
    }
  }
  return nombres;
}

function estadoInicial(
  modo: ModoWizard,
  cedularioFijo: CedularioFijo | null,
  materiasIniciales: SeleccionMaterias,
): EstadoWizard {
  const cedularioIds = modo !== 'alumno' && cedularioFijo ? [cedularioFijo.id] : [];
  const previas: Record<string, SeleccionMaterias> =
    modo === 'reasignar' && cedularioFijo ? { [cedularioFijo.id]: materiasIniciales } : {};
  return {
    paso: pasoInicial(modo),
    cedularioIds,
    alumnoIds: [],
    materias: materiasPorDefecto(cedularioIds, previas),
    indiceMaterias: 0,
  };
}

export function AsignarWizard({
  modo,
  cedularioFijo,
  alumnoFijo,
  bloqueo,
  idsAsignados,
  materiasIniciales,
  conAvance,
  onCerrar,
  onSolicitarCierre,
  onProgresoChange,
  onCapaPropiaChange,
}: AsignarWizardProps) {
  const t = useTranslations('cedularios.seguimiento');
  const tw = useTranslations('cedularios.seguimiento.asignar.wizard');
  const tErrores = useTranslations('cedularios.errores');
  const baseId = useId();
  const qc = useQueryClient();
  const cedularios = useCedularios();

  const mutacionAlumnos = useAsignarCedulario({ skipSuccessToast: modo === 'reasignar' });
  const mutacionCedularios = useAsignarCedularios();
  const enviando = mutacionAlumnos.isPending || mutacionCedularios.isPending;

  const [estado, setEstado] = useState<EstadoWizard>(() =>
    estadoInicial(modo, cedularioFijo, materiasIniciales),
  );
  const [resultado, setResultado] = useState<ResultadoVista | null>(null);
  const [mostrarErrores, setMostrarErrores] = useState(false);
  const [capaSelector, setCapaSelector] = useState(false);
  const [colapsados, setColapsados] = useState<Record<string, ReadonlySet<string>>>({});

  const pasos = pasosDelModo(modo);
  const nombresCedularios = useMemo(() => {
    const nombres: Record<string, string> = {};
    for (const item of cedularios.data ?? []) nombres[item.id] = item.nombre;
    if (cedularioFijo) nombres[cedularioFijo.id] = cedularioFijo.nombre;
    return nombres;
  }, [cedularios.data, cedularioFijo]);

  // Report progress and the own layer to the host; always release both on unmount
  const progreso = !bloqueo && !resultado && hayProgreso(estado, modo, materiasIniciales);
  const onProgresoRef = useRef(onProgresoChange);
  const onCapaRef = useRef(onCapaPropiaChange);
  useEffect(() => {
    onProgresoRef.current = onProgresoChange;
    onCapaRef.current = onCapaPropiaChange;
  });
  useEffect(() => {
    onProgresoRef.current?.(progreso);
  }, [progreso]);
  useEffect(() => {
    onCapaRef.current?.(enviando || capaSelector);
  }, [enviando, capaSelector]);
  useEffect(() => {
    return () => {
      onProgresoRef.current?.(false);
      onCapaRef.current?.(false);
    };
  }, []);

  const nombreAlumnoFijo = alumnoFijo
    ? nombreCompleto([alumnoFijo.nombre, alumnoFijo.apellido, alumnoFijo.apellidoMaterno])
    : '';
  const alumnoMostrado = nombreAlumnoFijo !== '' ? nombreAlumnoFijo : t('comun.alumno_sin_nombre');

  const cedularioActualId = estado.cedularioIds[estado.indiceMaterias];
  const totalCedularios = estado.cedularioIds.length;
  const indicePaso = Math.max(0, pasos.indexOf(estado.paso));

  const etiquetaPaso = (paso: PasoWizard): string =>
    paso === 'seleccion'
      ? modo === 'cedulario'
        ? tw('pasos.alumnos')
        : tw('pasos.cedularios')
      : tw(`pasos.${paso}`);

  // ── Navigation ───────────────────────────────────────────────────────────
  const irA = (parcial: Partial<EstadoWizard>) => {
    setMostrarErrores(false);
    setEstado((previo) => ({ ...previo, ...parcial }));
  };

  const atras = () => {
    if (enviando) return;
    if (estado.paso === 'materias' && estado.indiceMaterias > 0) {
      irA({ indiceMaterias: estado.indiceMaterias - 1 });
      return;
    }
    const anterior = pasoAnterior(modo, estado.paso);
    if (anterior === estado.paso) return;
    irA({
      paso: anterior,
      indiceMaterias: anterior === 'materias' ? Math.max(0, totalCedularios - 1) : estado.indiceMaterias,
    });
  };

  const siguiente = () => {
    if (enviando) return;
    if (!puedeAvanzar(modo, estado)) {
      setMostrarErrores(true);
      return;
    }
    if (estado.paso === 'seleccion') {
      irA({
        paso: pasoSiguiente(modo, 'seleccion'),
        indiceMaterias: 0,
        materias: sincronizarMaterias(estado.materias, estado.cedularioIds),
      });
      return;
    }
    if (estado.paso === 'materias' && estado.indiceMaterias < totalCedularios - 1) {
      irA({ indiceMaterias: estado.indiceMaterias + 1 });
      return;
    }
    irA({ paso: pasoSiguiente(modo, estado.paso) });
  };

  const primerPaso = estado.paso === pasos[0] && !(estado.paso === 'materias' && estado.indiceMaterias > 0);

  // ── Save ─────────────────────────────────────────────────────────────────
  const guardar = () => {
    if (enviando) return;

    if (modo === 'alumno') {
      if (!alumnoFijo) return;
      mutacionCedularios.mutate(
        { alumnoId: alumnoFijo.id, cedularios: construirEnvio(estado) },
        {
          onSuccess: (respuesta) => {
            if (!respuesta.ok) return;
            const resumen = resumirResultados(respuesta.data);
            const sinNovedad = resumen.asignados + resumen.reactivados === 0;
            if (resumen.fallidos.length > 0 || sinNovedad) {
              setResultado({ tipo: 'cedularios', filas: respuesta.data });
              return;
            }
            onCerrar();
          },
        },
      );
      return;
    }

    const cedularioId = cedularioFijo?.id;
    if (!cedularioId) return;
    const materias = estado.materias[cedularioId] ?? 'todas';
    const alumnoIds = modo === 'reasignar' ? (alumnoFijo ? [alumnoFijo.id] : []) : estado.alumnoIds;
    const nombres =
      modo === 'cedulario'
        ? nombresDeSeleccionados(qc, cedularioId, alumnoIds)
        : alumnoFijo
          ? { [alumnoFijo.id]: nombreAlumnoFijo }
          : {};

    mutacionAlumnos.mutate(
      { cedularioId, alumnoIds, materias },
      {
        onSuccess: (respuesta) => {
          if (!respuesta.ok) return;
          if (respuesta.data.some((fila) => fila.resultado === 'rechazado')) {
            setResultado({ tipo: 'alumnos', filas: respuesta.data, nombres });
            return;
          }
          if (modo === 'reasignar') mostrarExitoSeguimiento(t('toasts.reasignado'));
          onCerrar();
        },
      },
    );
  };

  /** Back to the confirm step with only the cedularios that failed. */
  const reintentarFallidos = () => {
    if (resultado?.tipo !== 'cedularios') return;
    const { fallidos } = resumirResultados(resultado.filas);
    setResultado(null);
    setMostrarErrores(false);
    setEstado((previo) => {
      const cedularioIds = previo.cedularioIds.filter((id) => fallidos.includes(id));
      return {
        ...previo,
        paso: 'confirmar',
        cedularioIds,
        materias: sincronizarMaterias(previo.materias, cedularioIds),
        indiceMaterias: Math.max(0, cedularioIds.length - 1),
      };
    });
  };

  // ── Header texts ─────────────────────────────────────────────────────────
  const titulo =
    modo === 'cedulario'
      ? t('asignar.titulo_cedulario')
      : modo === 'alumno'
        ? t('asignar.titulo_alumno')
        : t('asignar.titulo_reasignar');
  const descripcion =
    modo === 'cedulario'
      ? t('asignar.descripcion_cedulario', { cedulario: cedularioFijo?.nombre ?? '' })
      : modo === 'alumno'
        ? t('asignar.descripcion_alumno', { alumno: alumnoMostrado })
        : t('asignar.descripcion_reasignar', {
            cedulario: cedularioFijo?.nombre ?? '',
            alumno: alumnoMostrado,
          });

  const claseBloque =
    'flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-[var(--space-sm)] py-2 text-sm text-[var(--color-text-primary)]';

  const alumnoBloque = alumnoFijo && (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-sm font-medium text-[var(--color-text-primary)]">
        {t('asignar.alumnos.alumno_fijo')}
      </span>
      <div className={claseBloque}>
        <Avatar
          nombre={alumnoFijo.nombre}
          apellido={alumnoFijo.apellido}
          avatarUrl={alumnoFijo.avatarUrl}
          size="sm"
          className="shrink-0"
        />
        <span className="min-w-0 truncate font-medium">{alumnoMostrado}</span>
      </div>
    </div>
  );

  // ── Step bodies ──────────────────────────────────────────────────────────
  const pasoSeleccion = (
    <div className="flex min-w-0 flex-col gap-[var(--space-md)]">
      {modo === 'alumno' && (
        <>
          {alumnoBloque}
          <div className="flex min-w-0 flex-col gap-1">
            <CedulariosMultiSelector
              value={estado.cedularioIds}
              onChange={(ids) => setEstado((previo) => ({ ...previo, cedularioIds: ids }))}
              idsAsignados={idsAsignados}
              disabled={enviando}
            />
            {mostrarErrores && estado.cedularioIds.length === 0 && (
              <p role="alert" className="text-xs text-[var(--color-error)]">
                {tw('error_elegir_cedulario')}
              </p>
            )}
          </div>
        </>
      )}
      {modo === 'cedulario' && (
        <div className="flex min-w-0 flex-col gap-1">
          <AlumnosSelector
            cedularioId={cedularioFijo?.id}
            value={estado.alumnoIds}
            onChange={(ids) => setEstado((previo) => ({ ...previo, alumnoIds: ids }))}
            disabled={enviando}
          />
          {mostrarErrores && estado.alumnoIds.length === 0 && (
            <p role="alert" className="text-xs text-[var(--color-error)]">
              {tw('error_elegir_alumno')}
            </p>
          )}
        </div>
      )}
    </div>
  );

  const pasoMaterias = cedularioActualId !== undefined && (
    <div className="flex min-w-0 flex-col gap-[var(--space-md)]">
      <div className="flex min-w-0 flex-col gap-2">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">
          {totalCedularios > 1
            ? tw('cedulario_i_de_n', { actual: estado.indiceMaterias + 1, total: totalCedularios })
            : t('asignar.cedulario.etiqueta')}
        </span>
        <div className={claseBloque}>
          <span className="min-w-0 truncate font-medium">
            {nombresCedularios[cedularioActualId] ?? ''}
          </span>
        </div>
      </div>
      <MateriasSelector
        key={cedularioActualId}
        cedularioId={cedularioActualId}
        value={estado.materias[cedularioActualId] ?? 'todas'}
        onChange={(valor) =>
          setEstado((previo) => ({
            ...previo,
            materias: { ...previo.materias, [cedularioActualId]: valor },
          }))
        }
        conAvance={modo === 'reasignar' ? conAvance : undefined}
        disabled={enviando}
        forzarError={mostrarErrores}
        colapsados={colapsados[cedularioActualId]}
        onColapsadosChange={(siguienteSet) =>
          setColapsados((previo) => ({ ...previo, [cedularioActualId]: siguienteSet }))
        }
        onCapaPropiaChange={setCapaSelector}
      />
    </div>
  );

  const textoMaterias = (id: string): string => {
    const seleccion = estado.materias[id] ?? 'todas';
    return seleccion === 'todas'
      ? tw('todas_las_materias_resumen')
      : tw('materias_elegidas', { count: seleccion.length });
  };

  const nombresAlumnosElegidos =
    modo === 'cedulario' && cedularioFijo
      ? nombresDeSeleccionados(qc, cedularioFijo.id, estado.alumnoIds)
      : {};

  const pasoConfirmar = (
    <div className="flex min-w-0 flex-col gap-[var(--space-md)]">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{tw('resumen_titulo')}</h3>

      {modo !== 'cedulario' && alumnoBloque}

      {modo === 'cedulario' && (
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {tw('resumen_alumnos', { count: estado.alumnoIds.length })}
          </span>
          <ul className="flex max-h-40 flex-col divide-y divide-[var(--color-border)] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)]">
            {estado.alumnoIds.map((id) => (
              <li key={id} className="px-[var(--space-sm)] py-2 text-sm text-[var(--color-text-primary)]">
                {nombresAlumnosElegidos[id] || t('comun.alumno_sin_nombre')}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-2">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">
          {modo === 'alumno'
            ? tw('resumen_cedularios', { count: totalCedularios })
            : t('asignar.cedulario.etiqueta')}
        </span>
        <ul className="flex flex-col divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
          {estado.cedularioIds.map((id) => (
            <li
              key={id}
              className="flex flex-wrap items-baseline justify-between gap-x-3 px-[var(--space-sm)] py-2 text-sm"
            >
              <span className="min-w-0 truncate font-medium text-[var(--color-text-primary)]">
                {nombresCedularios[id] ?? ''}
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">{textoMaterias(id)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  // ── Body ─────────────────────────────────────────────────────────────────
  let cuerpo: ReactNode;
  if (bloqueo) {
    cuerpo = (
      <p
        role="status"
        className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-[var(--space-sm)] text-sm text-[var(--color-text-primary)]"
      >
        {bloqueo === 'inactivo'
          ? t('asignar.alumno_inactivo_aviso')
          : bloqueo === 'sin_permisos'
            ? tErrores('sin_permisos')
            : tErrores('asignacion_duplicada')}
      </p>
    );
  } else if (resultado?.tipo === 'alumnos') {
    cuerpo = (
      <ResultadoAsignacion
        resultados={resultado.filas}
        nombresAlumnos={resultado.nombres}
        onCerrar={onCerrar}
      />
    );
  } else if (resultado?.tipo === 'cedularios') {
    cuerpo = (
      <ResultadoCedularios
        resultados={resultado.filas}
        nombresCedularios={nombresCedularios}
        onReintentar={reintentarFallidos}
        onCerrar={onCerrar}
      />
    );
  } else {
    cuerpo = (
      <div id={`${baseId}-paso`} className="min-w-0">
        {estado.paso === 'seleccion' && pasoSeleccion}
        {estado.paso === 'materias' && pasoMaterias}
        {estado.paso === 'confirmar' && pasoConfirmar}
      </div>
    );
  }

  const mostrarPasos = !bloqueo && !resultado;
  const ultimoPaso = estado.paso === 'confirmar';

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--color-bg)]">
      <header className="flex flex-col gap-2 border-b border-[var(--color-border)] p-[var(--space-md)] pr-12">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{titulo}</h2>
          <p className="text-sm text-[var(--color-text-muted)]">{descripcion}</p>
        </div>
        {mostrarPasos && (
          <nav aria-label={tw('pasos_aria')}>
            <p className="sr-only" aria-live="polite">
              {tw('paso_x_de_n', { actual: indicePaso + 1, total: pasos.length })}
              {': '}
              {etiquetaPaso(estado.paso)}
            </p>
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              {pasos.map((paso, indice) => {
                const actual = indice === indicePaso;
                return (
                  <li
                    key={paso}
                    aria-current={actual ? 'step' : undefined}
                    className={cn(
                      'flex items-center gap-1.5',
                      actual
                        ? 'font-semibold text-[var(--color-text-primary)]'
                        : 'text-[var(--color-text-muted)]',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'flex size-5 items-center justify-center rounded-full border text-[11px]',
                        actual
                          ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold)] text-white'
                          : indice < indicePaso
                            ? 'border-[var(--color-brand-gold)] text-[var(--color-brand-gold)]'
                            : 'border-[var(--color-border)]',
                      )}
                    >
                      {indice + 1}
                    </span>
                    <span>{etiquetaPaso(paso)}</span>
                    {indice < pasos.length - 1 && (
                      <span aria-hidden="true" className="ml-1 text-[var(--color-border)]">
                        /
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-[var(--space-md)]">{cuerpo}</div>

      {mostrarPasos ? (
        <footer className="flex flex-col-reverse gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-[var(--space-md)] sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" onClick={onSolicitarCierre} disabled={enviando}>
            {t('comun.cancelar')}
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              onClick={atras}
              disabled={enviando || primerPaso}
            >
              {tw('atras')}
            </Button>
            {ultimoPaso ? (
              <Button type="button" onClick={guardar} loading={enviando}>
                {enviando
                  ? t('asignar.asignando')
                  : modo === 'reasignar'
                    ? t('asignar.confirmar_reasignar')
                    : t('asignar.confirmar')}
              </Button>
            ) : (
              <Button type="button" onClick={siguiente} disabled={enviando}>
                {tw('siguiente')}
              </Button>
            )}
          </div>
        </footer>
      ) : bloqueo ? (
        <footer className="flex justify-end border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-[var(--space-md)]">
          <Button type="button" variant="ghost" onClick={onCerrar}>
            {t('comun.cerrar')}
          </Button>
        </footer>
      ) : null}
    </div>
  );
}
