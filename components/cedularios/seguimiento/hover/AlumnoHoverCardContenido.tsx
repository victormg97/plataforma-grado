'use client';

/**
 * Content of the student hover card. It is mounted only while the card is open, so the
 * summary query (`useResumenAlumno`) starts when the card opens and never for closed cards.
 *
 * While loading it shows the data received through props plus a loading indicator. On error
 * it shows a retry action and keeps "Ir a perfil". The buttons close the card and write the
 * `seg_*` params with `useSegUrl` (except "Ir a perfil", which navigates).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronRight, Loader2 } from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { agregadoAlumno } from '@/lib/cedularios/seguimiento/agregados';
import { accionesHoverCard } from '@/lib/cedularios/seguimiento/permisos';
import { calcularPorcentaje } from '@/lib/cedularios/seguimiento/porcentaje';
import { rutaPerfilAlumno } from '@/lib/cedularios/seguimiento/rutas';
import { PorcentajeTexto } from '../compartidos/PorcentajeTexto';
import { ProgresoBarra } from '../compartidos/ProgresoBarra';
import { useResumenAlumno } from '../hooks/useResumenAlumno';
import { useSegRol } from '../hooks/useSegRol';
import { useSegUrl } from '../url/useSegUrl';
import type { AlumnoHoverCardAlumno } from './AlumnoHoverCard';

/** Maximum number of cedularios listed in the summary; the rest become "+N more". */
const MAX_CEDULARIOS_VISIBLES = 3;

export interface AlumnoHoverCardContenidoProps {
  /** Data already on screen, shown right away while the summary loads. */
  alumno: AlumnoHoverCardAlumno;
  /** Closes the card. */
  close: () => void;
  /** Pins the card to its current side (top or bottom) so switching views does not make it jump. */
  fijarLado?: () => void;
}

export function AlumnoHoverCardContenido({ alumno, close, fijarLado }: AlumnoHoverCardContenidoProps) {
  const t = useTranslations('cedularios.seguimiento.hover');
  const router = useRouter();
  const { rol } = useSegRol();
  const { abrir } = useSegUrl();
  const consulta = useResumenAlumno(alumno.id);
  const { data, isError, refetch, isFetching } = consulta;
  const cargando = consulta.isPending;
  const hayError = isError && !data;

  const [listaAbierta, setListaAbierta] = useState(false);
  const listaRef = useRef<HTMLDivElement | null>(null);
  const revisarRef = useRef<HTMLButtonElement | null>(null);
  const devolverFocoRef = useRef(false);

  // Fresh data wins over the props once the summary is available.
  const datos = data?.alumno ?? {
    nombre: alumno.nombre,
    apellido: alumno.apellido,
    email: alumno.email,
    avatarUrl: alumno.avatar_url ?? null,
    activo: true,
  };

  const activas = useMemo(
    () => (data?.asignaciones ?? []).filter((asignacion) => asignacion.estado === 'activa'),
    [data],
  );
  const global = useMemo(() => agregadoAlumno(activas), [activas]);
  const porcentajeGlobal = calcularPorcentaje(global.cubiertas, global.total);

  const acciones = accionesHoverCard({
    totalActivas: activas.length,
    puedeEditar: data?.puedeEditar ?? false,
    alumnoActivo: datos.activo,
  });
  const resumenListo = !cargando && !hayError;
  const mostrarLista = listaAbierta && acciones.revisar === 'menu';

  // Keep keyboard focus inside the card when the cedulario list opens or closes.
  useEffect(() => {
    if (listaAbierta) {
      listaRef.current?.querySelector<HTMLElement>('button')?.focus();
    } else if (devolverFocoRef.current) {
      devolverFocoRef.current = false;
      revisarRef.current?.focus();
    }
  }, [listaAbierta]);

  const irAPerfil = () => {
    close();
    router.push(rutaPerfilAlumno(rol === 'admin' ? 'admin' : 'profesor', alumno.id));
  };

  const asignar = () => {
    abrir({ modal: 'asignar', alumno: alumno.id });
    close();
  };

  const revisar = (cedularioId: string) => {
    abrir({ modal: 'revision', alumno: alumno.id, cedulario: cedularioId });
    close();
  };

  const alActivarRevisar = () => {
    if (acciones.revisar === 'directo' && activas[0]) {
      revisar(activas[0].cedularioId);
    } else if (acciones.revisar === 'menu') {
      // The list has another height: stay on the side the card is on so it does not jump away
      // from the pointer (it would leave an empty gap that closes the card).
      fijarLado?.();
      setListaAbierta(true);
    }
  };

  const volver = () => {
    devolverFocoRef.current = true;
    setListaAbierta(false);
  };

  const nombreCompleto = `${datos.nombre} ${datos.apellido}`.trim();
  const visibles = activas.slice(0, MAX_CEDULARIOS_VISIBLES);
  const restantes = activas.length - visibles.length;

  return (
    <div className="w-72 max-w-full space-y-3 p-3">
      <div className="flex items-center gap-3">
        <Avatar
          nombre={datos.nombre}
          apellido={datos.apellido}
          avatarUrl={datos.avatarUrl}
          size="md"
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
            {nombreCompleto}
          </p>
          <p className="truncate text-xs text-[var(--color-text-muted)]">{datos.email}</p>
          {resumenListo && acciones.etiquetaInactivo && (
            <span className="mt-1 inline-block rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
              {t('inactivo')}
            </span>
          )}
        </div>
      </div>

      {cargando && (
        <div
          role="status"
          className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]"
        >
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          <span>{t('cargando')}</span>
        </div>
      )}

      {hayError && (
        <div role="alert" className="space-y-2">
          <p className="text-xs text-[var(--color-error)]">{t('error_carga')}</p>
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            loading={isFetching}
            onClick={() => {
              void refetch();
            }}
          >
            {t('reintentar')}
          </Button>
        </div>
      )}

      {resumenListo && !mostrarLista && (
        <div className="space-y-2">
          {activas.length > 0 || !acciones.mensajeSinCedularios ? (
            <p className="text-xs text-[var(--color-text-muted)]">
              {t('cedularios_activos', { count: activas.length })}
            </p>
          ) : (
            <p className="text-xs text-[var(--color-text-muted)]">{t('sin_cedularios')}</p>
          )}

          {activas.length > 0 && (
            <>
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-[var(--color-text-muted)]">{t('avance_global')}</span>
                  <PorcentajeTexto porcentaje={porcentajeGlobal} className="text-sm font-medium" />
                </div>
                <ProgresoBarra porcentaje={porcentajeGlobal} tamano="sm" />
              </div>

              <ul aria-label={t('lista_cedularios_aria')} className="space-y-1">
                {visibles.map((asignacion) => (
                  <li
                    key={asignacion.asignacionId}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="min-w-0 truncate text-[var(--color-text-primary)]">
                      {asignacion.cedularioNombre}
                    </span>
                    <PorcentajeTexto porcentaje={asignacion.porcentaje} className="shrink-0" />
                  </li>
                ))}
                {restantes > 0 && (
                  <li className="text-xs text-[var(--color-text-muted)]">
                    {t('mas', { count: restantes })}
                  </li>
                )}
              </ul>
            </>
          )}
        </div>
      )}

      {mostrarLista ? (
        <div ref={listaRef} className="space-y-2">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-[var(--color-text-primary)]">
              {t('elegir_cedulario')}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">{t('elegir_cedulario_ayuda')}</p>
          </div>
          <ul aria-label={t('lista_cedularios_aria')} className="space-y-1">
            {activas.map((asignacion) => (
              <li key={asignacion.asignacionId}>
                <button
                  type="button"
                  onClick={() => revisar(asignacion.cedularioId)}
                  title={t('abrir_revision', { cedulario: asignacion.cedularioNombre })}
                  className="group flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-left text-sm text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-brand-gold)] hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]"
                >
                  <span className="min-w-0 truncate">{asignacion.cedularioNombre}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    <PorcentajeTexto porcentaje={asignacion.porcentaje} className="text-xs" />
                    <ChevronRight
                      className="size-4 text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-brand-gold)] motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Button variant="ghost" size="sm" fullWidth onClick={volver}>
            {t('volver')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Button variant="secondary" size="sm" fullWidth onClick={irAPerfil}>
            {t('ir_a_perfil')}
          </Button>
          {resumenListo && acciones.asignar && (
            <Button size="sm" fullWidth onClick={asignar}>
              {t('asignar_cedulario')}
            </Button>
          )}
          {resumenListo && acciones.revisar !== 'ninguno' && (
            <Button
              ref={revisarRef}
              size="sm"
              fullWidth
              onClick={alActivarRevisar}
              aria-expanded={acciones.revisar === 'menu' ? false : undefined}
            >
              {t('revisar_cedulario')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
