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
 *
 * The pieces live next to this file: `WizardCabecera`, `WizardPasos`, `WizardPie` and the
 * types/helpers in `asignarWizardTipos`.
 */

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCedularios } from '@/components/cedularios/hooks/useCedularios';
import {
  construirEnvio,
  hayProgreso,
  pasoAnterior,
  pasoSiguiente,
  pasosDelModo,
  puedeAvanzar,
  resumirResultados,
  sincronizarMaterias,
  type EstadoWizard,
  type ModoWizard,
  type SeleccionMaterias,
} from '@/lib/cedularios/seguimiento/asignacion-wizard';
import type { AlumnoResumen } from '@/lib/queries/cedularios/seguimiento/resumen';
import { mostrarExitoSeguimiento } from '../hooks/segInvalidaciones';
import { useAsignarCedulario } from '../hooks/useAsignarCedulario';
import { useAsignarCedularios } from '../hooks/useAsignarCedularios';
import { etiquetasAsignatario } from './etiquetasAsignatario';
import {
  estadoInicial,
  nombreCompleto,
  nombresDeSeleccionados,
  type Bloqueo,
  type CedularioFijo,
  type ResultadoVista,
} from './asignarWizardTipos';
import { PasoConfirmar, PasoMaterias, PasoSeleccion } from './WizardPasos';
import { WizardCabecera } from './WizardCabecera';
import { WizardPie } from './WizardPie';
import { ResultadoAsignacion } from './ResultadoAsignacion';
import { ResultadoCedularios } from './ResultadoCedularios';

// Re-exported: other files import these from the wizard module.
export type { Bloqueo, CedularioFijo };

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
        ? t(etiquetasAsignatario(alumnoFijo?.rol).descripcion, { alumno: alumnoMostrado })
        : t('asignar.descripcion_reasignar', {
            cedulario: cedularioFijo?.nombre ?? '',
            alumno: alumnoMostrado,
          });

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
        {estado.paso === 'seleccion' && (
          <PasoSeleccion
            modo={modo}
            estado={estado}
            setEstado={setEstado}
            alumnoFijo={alumnoFijo}
            nombreAlumno={alumnoMostrado}
            cedularioFijo={cedularioFijo}
            idsAsignados={idsAsignados}
            enviando={enviando}
            mostrarErrores={mostrarErrores}
          />
        )}
        {estado.paso === 'materias' && cedularioActualId !== undefined && (
          <PasoMaterias
            modo={modo}
            estado={estado}
            setEstado={setEstado}
            cedularioActualId={cedularioActualId}
            nombresCedularios={nombresCedularios}
            conAvance={conAvance}
            enviando={enviando}
            mostrarErrores={mostrarErrores}
            colapsados={colapsados[cedularioActualId]}
            onColapsadosChange={(siguienteSet) =>
              setColapsados((previo) => ({ ...previo, [cedularioActualId]: siguienteSet }))
            }
            onCapaPropiaChange={setCapaSelector}
          />
        )}
        {estado.paso === 'confirmar' && (
          <PasoConfirmar
            modo={modo}
            estado={estado}
            alumnoFijo={alumnoFijo}
            nombreAlumno={alumnoMostrado}
            cedularioFijo={cedularioFijo}
            nombresCedularios={nombresCedularios}
          />
        )}
      </div>
    );
  }

  const mostrarPasos = !bloqueo && !resultado;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--color-bg)]">
      <WizardCabecera
        modo={modo}
        titulo={titulo}
        descripcion={descripcion}
        mostrarPasos={mostrarPasos}
        pasos={pasos}
        paso={estado.paso}
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-[var(--space-md)]">{cuerpo}</div>
      <WizardPie
        modo={modo}
        bloqueo={bloqueo}
        mostrarPasos={mostrarPasos}
        enviando={enviando}
        primerPaso={primerPaso}
        ultimoPaso={estado.paso === 'confirmar'}
        onCerrar={onCerrar}
        onSolicitarCierre={onSolicitarCierre}
        onAtras={atras}
        onSiguiente={siguiente}
        onGuardar={guardar}
      />
    </div>
  );
}
