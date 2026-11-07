'use client';

/**
 * Assign dialog of the per-student tracking (seg_modal=asignar). It is the content of the
 * tracking overlay, so it renders its own header, body and footer and never a Dialog.
 *
 * Three modes, derived from the seg_* URL params:
 * - cedulario fixed (seg_cedulario only): student multi-picker + materia picker (tab Alumnos).
 * - student fixed (seg_alumno only): cedulario picker + materia picker (hover card and record).
 * - reassign (both): the assignment was unassigned. Both are fixed and the materias that were
 *   assigned when it was unassigned come preselected (read from the progress of that assignment).
 *
 * Rules:
 * - The form is validated with `asignarSchema` (react-hook-form + zodResolver).
 * - An inactive student cannot receive assignments from anyone (D-S20): no form, only a notice.
 * - Rejected students are listed with their reason (`ResultadoAsignacion`). Without rejections
 *   the dialog closes and the success toast (5 s) is shown by the mutation hook.
 * - `onCapaPropiaChange` tells the overlay while an operation is running, so Escape does not
 *   close the overlay and lose the result.
 */

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { createClient } from '@/lib/supabase/client';
import { useCedularios } from '@/components/cedularios/hooks/useCedularios';
import { useMateriasTree } from '@/components/cedularios/hooks/useMaterias';
import {
  CedulariosQueryError,
  consultar,
  reintentarConsulta,
} from '@/components/cedularios/hooks/cedulariosQuery';
import { SEG_STALE_TIME, seguimientoKeys } from '@/lib/cedularios/seguimiento/keys';
import { tieneDatosDeAvance } from '@/lib/cedularios/seguimiento/subconjunto';
import {
  fetchResumenAlumno,
  type AlumnoResumen,
  type ResumenAlumno,
} from '@/lib/queries/cedularios/seguimiento/resumen';
import type { AlumnoAsignable } from '@/lib/queries/cedularios/seguimiento/asignables';
import {
  asignarSchema,
  type AsignarData,
  type AsignarInput,
} from '@/lib/validations/cedularioSeguimiento.schema';
import type { ResultadoAsignacionAlumno } from '@/app/actions/cedularios/seguimiento/asignaciones';
import { mostrarExitoSeguimiento } from '../hooks/segInvalidaciones';
import { useAsignarCedulario } from '../hooks/useAsignarCedulario';
import { useProgresoAsignacion } from '../hooks/useProgresoAsignacion';
import { useResumenAlumno } from '../hooks/useResumenAlumno';
import { useSegUrl } from '../url/useSegUrl';
import { AlumnosSelector } from './AlumnosSelector';
import { CedularioPickerSelector } from './CedularioPickerSelector';
import { MateriasSelector, type SeleccionMaterias } from './MateriasSelector';
import { ResultadoAsignacion } from './ResultadoAsignacion';

export interface AsignarCedularioDialogProps {
  /** Closes the dialog. Defaults to removing every seg_* param from the URL. */
  onCerrar?: () => void;
  /** True while this dialog has its own layer open (an assignment is running). */
  onCapaPropiaChange?: (abierta: boolean) => void;
}

type ModoAsignar = 'cedulario' | 'alumno' | 'reasignar';

type Bloqueo = 'inactivo' | 'sin_permisos' | 'ya_asignado';

interface CedularioFijo {
  id: string;
  nombre: string;
}

function nombreCompleto(partes: readonly (string | null | undefined)[]): string {
  return partes
    .map((parte) => (parte ?? '').trim())
    .filter((parte) => parte !== '')
    .join(' ');
}

/**
 * Summary of the student including unassigned assignments (needed to find the assignment to
 * reassign). The key lives under the summary prefix, so every summary invalidation reaches it.
 */
function useResumenConDesasignadas(alumnoId: string | null, enabled: boolean) {
  return useQuery<ResumenAlumno | null, CedulariosQueryError>({
    queryKey: [...seguimientoKeys.resumen(alumnoId ?? ''), 'con_desasignadas'] as const,
    queryFn: () => consultar(() => fetchResumenAlumno(createClient(), alumnoId as string, true)),
    enabled: Boolean(alumnoId) && enabled,
    staleTime: SEG_STALE_TIME.resumen,
    retry: reintentarConsulta,
  });
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

// ---------------------------------------------------------------------------
// Container: reads the URL, loads what the mode needs and gates the form
// ---------------------------------------------------------------------------

export function AsignarCedularioDialog({ onCerrar, onCapaPropiaChange }: AsignarCedularioDialogProps) {
  const t = useTranslations('cedularios.seguimiento');
  const tErrores = useTranslations('cedularios.errores');
  const { estado, cerrar } = useSegUrl();
  const cerrarDialogo = onCerrar ?? cerrar;

  const alumnoId = estado.alumno;
  const cedularioId = estado.cedulario;
  const modo: ModoAsignar = alumnoId && cedularioId ? 'reasignar' : alumnoId ? 'alumno' : 'cedulario';

  const cedularios = useCedularios();
  const resumenActivas = useResumenAlumno(alumnoId, { enabled: modo === 'alumno' });
  const resumenTodas = useResumenConDesasignadas(alumnoId, modo === 'reasignar');
  const resumenQuery = modo === 'reasignar' ? resumenTodas : resumenActivas;
  const resumen = resumenQuery.data ?? null;

  // Assignment to reassign: the one of the (student, cedulario) pair, whatever its state
  const previa = useMemo(
    () =>
      modo === 'reasignar'
        ? (resumen?.asignaciones.find((asignacion) => asignacion.cedularioId === cedularioId) ?? null)
        : null,
    [modo, resumen, cedularioId],
  );
  const leePrevias = previa?.estado === 'desasignada';

  const progresoQuery = useProgresoAsignacion(previa?.asignacionId, { enabled: leePrevias });
  const arbolQuery = useMateriasTree(modo === 'reasignar' && leePrevias ? cedularioId : null);

  const materiasIniciales = useMemo<SeleccionMaterias>(() => {
    if (!leePrevias) return 'todas';
    const activas = new Set((arbolQuery.data ?? []).filter((n) => n.activo).map((n) => n.id));
    const previas = (progresoQuery.data ?? [])
      .filter((fila) => fila.asignada && activas.has(fila.materiaId))
      .map((fila) => fila.materiaId);
    // Same set as "all": keep the default so new materias are included too
    return previas.length > 0 && previas.length === activas.size ? 'todas' : previas;
  }, [leePrevias, arbolQuery.data, progresoQuery.data]);

  const conAvance = useMemo<ReadonlySet<string>>(() => {
    const ids = new Set<string>();
    for (const fila of progresoQuery.data ?? []) {
      if (tieneDatosDeAvance(fila)) ids.add(fila.materiaId);
    }
    return ids;
  }, [progresoQuery.data]);

  const cargando =
    (modo === 'cedulario' && cedularios.isPending) ||
    (modo !== 'cedulario' && resumenQuery.isPending) ||
    (leePrevias && (progresoQuery.isPending || arbolQuery.isPending));
  const hayError =
    (modo === 'cedulario' && cedularios.isError) ||
    (modo !== 'cedulario' && resumenQuery.isError) ||
    (leePrevias && (progresoQuery.isError || arbolQuery.isError));

  const reintentar = () => {
    if (modo === 'cedulario' && cedularios.isError) void cedularios.refetch();
    if (modo !== 'cedulario' && resumenQuery.isError) void resumenQuery.refetch();
    if (leePrevias && progresoQuery.isError) void progresoQuery.refetch();
    if (leePrevias && arbolQuery.isError) void arbolQuery.refetch();
  };

  // Cedulario fixed by the URL (cedulario and reassign modes)
  let cedularioFijo: CedularioFijo | null = null;
  if (modo === 'cedulario') {
    const item = (cedularios.data ?? []).find((c) => c.id === cedularioId);
    if (item?.activo) cedularioFijo = { id: item.id, nombre: item.nombre };
  } else if (modo === 'reasignar' && previa) {
    cedularioFijo = { id: previa.cedularioId, nombre: previa.cedularioNombre };
  }

  // Message shown instead of the form when the dialog cannot work
  let mensaje: string | null = null;
  if (!cargando && !hayError) {
    if (modo === 'cedulario' && !cedularioFijo) mensaje = tErrores('cedulario_no_disponible');
    else if (modo !== 'cedulario' && !resumen) mensaje = t('comun.error_carga');
    else if (modo === 'reasignar' && !previa) mensaje = tErrores('cedulario_no_disponible');
  }

  const vacio = (contenido: ReactNode, accion?: ReactNode) => (
    <div className="flex h-full min-h-0 flex-col items-start gap-3 bg-[var(--color-bg)] p-[var(--space-md)] pr-12">
      {contenido}
      <div className="flex gap-2">
        {accion}
        <Button type="button" variant="ghost" size="sm" onClick={cerrarDialogo}>
          {t('comun.cerrar')}
        </Button>
      </div>
    </div>
  );

  if (hayError) {
    return vacio(
      <p role="alert" className="text-sm text-[var(--color-error)]">
        {t('comun.error_carga')}
      </p>,
      <Button type="button" variant="secondary" size="sm" onClick={reintentar}>
        {t('comun.reintentar')}
      </Button>,
    );
  }

  if (cargando) {
    return vacio(
      <p role="status" className="text-sm text-[var(--color-text-muted)]">
        {t('comun.cargando')}
      </p>,
    );
  }

  if (mensaje) {
    return vacio(
      <p role="alert" className="text-sm text-[var(--color-error)]">
        {mensaje}
      </p>,
    );
  }

  let bloqueo: Bloqueo | null = null;
  if (resumen && !resumen.alumno.activo) bloqueo = 'inactivo';
  else if (resumen && !resumen.puedeAsignar) bloqueo = 'sin_permisos';
  else if (previa?.estado === 'activa') bloqueo = 'ya_asignado';

  const idsAsignados =
    modo === 'alumno'
      ? (resumen?.asignaciones ?? [])
          .filter((asignacion) => asignacion.estado === 'activa')
          .map((asignacion) => asignacion.cedularioId)
      : [];

  return (
    <AsignarContenido
      key={`${modo}:${alumnoId ?? ''}:${cedularioId ?? ''}:${previa?.asignacionId ?? ''}`}
      modo={modo}
      cedularioFijo={cedularioFijo}
      alumnoFijo={resumen?.alumno ?? null}
      bloqueo={bloqueo}
      idsAsignados={idsAsignados}
      materiasIniciales={materiasIniciales}
      conAvance={conAvance}
      onCerrar={cerrarDialogo}
      onCapaPropiaChange={onCapaPropiaChange}
    />
  );
}

// ---------------------------------------------------------------------------
// Content: header, form and footer
// ---------------------------------------------------------------------------

interface AsignarContenidoProps {
  modo: ModoAsignar;
  cedularioFijo: CedularioFijo | null;
  alumnoFijo: AlumnoResumen | null;
  bloqueo: Bloqueo | null;
  /** Cedulario ids the fixed student already has with an active assignment. */
  idsAsignados: readonly string[];
  materiasIniciales: SeleccionMaterias;
  conAvance: ReadonlySet<string>;
  onCerrar: () => void;
  onCapaPropiaChange?: (abierta: boolean) => void;
}

interface ResultadoVista {
  filas: ResultadoAsignacionAlumno[];
  nombres: Record<string, string>;
}

function AsignarContenido({
  modo,
  cedularioFijo,
  alumnoFijo,
  bloqueo,
  idsAsignados,
  materiasIniciales,
  conAvance,
  onCerrar,
  onCapaPropiaChange,
}: AsignarContenidoProps) {
  const t = useTranslations('cedularios.seguimiento');
  const tErrores = useTranslations('cedularios.errores');
  const formId = useId();
  const qc = useQueryClient();
  const mutation = useAsignarCedulario({ skipSuccessToast: modo === 'reasignar' });
  const enviando = mutation.isPending;
  const [resultado, setResultado] = useState<ResultadoVista | null>(null);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitted },
  } = useForm<AsignarInput, unknown, AsignarData>({
    resolver: zodResolver(asignarSchema),
    defaultValues: {
      cedularioId: cedularioFijo?.id ?? '',
      alumnoIds: alumnoFijo && modo !== 'cedulario' ? [alumnoFijo.id] : [],
      materias: materiasIniciales,
    },
  });

  const cedularioSel = useWatch({ control, name: 'cedularioId' });
  const alumnoIds = useWatch({ control, name: 'alumnoIds' });
  const materias = useWatch({ control, name: 'materias' });

  // Report the own layer (a running operation) to the overlay; always release it on unmount
  const onCapaRef = useRef(onCapaPropiaChange);
  useEffect(() => {
    onCapaRef.current = onCapaPropiaChange;
  });
  useEffect(() => {
    onCapaRef.current?.(enviando);
  }, [enviando]);
  useEffect(() => {
    return () => onCapaRef.current?.(false);
  }, []);

  const mensajeError = (clave: string | undefined): string | null => {
    if (!clave) return null;
    return tErrores.has(clave) ? tErrores(clave) : t('comun.error_carga');
  };

  const nombreAlumnoFijo = alumnoFijo
    ? nombreCompleto([alumnoFijo.nombre, alumnoFijo.apellido, alumnoFijo.apellidoMaterno])
    : '';
  const alumnoMostrado = nombreAlumnoFijo !== '' ? nombreAlumnoFijo : t('comun.alumno_sin_nombre');

  const enviar = (datos: AsignarData) => {
    if (enviando) return;
    const nombres =
      modo === 'cedulario'
        ? nombresDeSeleccionados(qc, datos.cedularioId, datos.alumnoIds)
        : alumnoFijo
          ? { [alumnoFijo.id]: nombreAlumnoFijo }
          : {};

    mutation.mutate(datos, {
      onSuccess: (respuesta) => {
        if (!respuesta.ok) return;
        if (respuesta.data.some((fila) => fila.resultado === 'rechazado')) {
          setResultado({ filas: respuesta.data, nombres });
          return;
        }
        if (modo === 'reasignar') mostrarExitoSeguimiento(t('toasts.reasignado'));
        onCerrar();
      },
    });
  };

  const cerrar = () => {
    // Do not close while the action runs, so the result is not lost
    if (enviando) return;
    onCerrar();
  };

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

  const materiasVacia = Array.isArray(materias) && materias.length === 0;
  const errorCedulario = mensajeError(errors.cedularioId?.message);
  const errorAlumnos = mensajeError(errors.alumnoIds?.message);

  const claseBloque =
    'flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-[var(--space-sm)] py-2 text-sm text-[var(--color-text-primary)]';

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
  } else if (resultado) {
    cuerpo = (
      <ResultadoAsignacion
        resultados={resultado.filas}
        nombresAlumnos={resultado.nombres}
        onCerrar={onCerrar}
      />
    );
  } else {
    cuerpo = (
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          void handleSubmit(enviar)(event);
        }}
        className="flex min-w-0 flex-col gap-[var(--space-md)]"
      >
        {modo !== 'cedulario' && alumnoFijo && (
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
        )}

        {modo === 'cedulario' && (
          <div className="flex min-w-0 flex-col gap-1">
            <AlumnosSelector
              cedularioId={cedularioFijo?.id}
              value={alumnoIds}
              onChange={(ids) =>
                setValue('alumnoIds', ids, { shouldDirty: true, shouldValidate: isSubmitted })
              }
              disabled={enviando}
            />
            {errorAlumnos && (
              <p role="alert" className="text-xs text-[var(--color-error)]">
                {errorAlumnos}
              </p>
            )}
          </div>
        )}

        {modo === 'alumno' && (
          <div className="flex min-w-0 flex-col gap-1">
            <CedularioPickerSelector
              value={cedularioSel === '' ? null : cedularioSel}
              onChange={(id) => {
                setValue('cedularioId', id, { shouldDirty: true, shouldValidate: isSubmitted });
                // A different cedulario has a different tree, so start again from "all"
                setValue('materias', 'todas', { shouldDirty: true });
              }}
              idsAsignados={idsAsignados}
              disabled={enviando}
            />
            {errorCedulario && (
              <p role="alert" className="text-xs text-[var(--color-error)]">
                {errorCedulario}
              </p>
            )}
          </div>
        )}

        {modo === 'reasignar' && cedularioFijo && (
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {t('asignar.cedulario.etiqueta')}
            </span>
            <div className={claseBloque}>
              <span className="min-w-0 truncate font-medium">{cedularioFijo.nombre}</span>
            </div>
          </div>
        )}

        {cedularioSel !== '' && (
          <MateriasSelector
            cedularioId={cedularioSel}
            value={materias}
            onChange={(valor) =>
              setValue('materias', valor, { shouldDirty: true, shouldValidate: isSubmitted })
            }
            conAvance={conAvance}
            disabled={enviando}
            forzarError={isSubmitted && materiasVacia}
          />
        )}
      </form>
    );
  }

  const mostrarAcciones = !bloqueo && !resultado;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--color-bg)]">
      <header className="flex flex-col gap-1 border-b border-[var(--color-border)] p-[var(--space-md)] pr-12">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{titulo}</h2>
        <p className="text-sm text-[var(--color-text-muted)]">{descripcion}</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-[var(--space-md)]">{cuerpo}</div>

      {mostrarAcciones ? (
        <footer className="flex flex-col-reverse gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-[var(--space-md)] sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={cerrar} disabled={enviando}>
            {t('comun.cancelar')}
          </Button>
          <Button type="submit" form={formId} loading={enviando}>
            {enviando
              ? t('asignar.asignando')
              : modo === 'reasignar'
                ? t('asignar.confirmar_reasignar')
                : t('asignar.confirmar')}
          </Button>
        </footer>
      ) : bloqueo ? (
        <footer className="flex justify-end border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-[var(--space-md)]">
          <Button type="button" variant="ghost" onClick={cerrar}>
            {t('comun.cerrar')}
          </Button>
        </footer>
      ) : null}
    </div>
  );
}
