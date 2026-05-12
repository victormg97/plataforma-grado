'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell, CheckCheck, CheckCircle2, XCircle, ArrowLeftRight,
  CalendarPlus, CalendarClock, CalendarOff, ClipboardList,
  Calendar, Clock, Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { buildAlumnoHorarioDetailHref } from '@/lib/utils/horarioNavigation';
import { useUIStore } from '@/stores/useUIStore';
import { useUserStore } from '@/stores/useUserStore';
import { ModalRespuestaSolicitud } from '@/components/notificaciones/ModalRespuestaSolicitud';
import { ModalRechazoDetalle } from '@/components/notificaciones/ModalRechazoDetalle';
import type { SolicitudCambio } from '@/lib/hooks/useSolicitudesCambio';
import type { TipoNotificacion } from '@/lib/supabase/types';

type Notificacion = {
  id: string;
  destinatario_id: string;
  tipo: TipoNotificacion;
  mensaje: string;
  leida: boolean;
  horario_id: string | null;
  alumno_id: string | null;
  programa_id: string | null;
  solicitud_id: string | null;
  alumno: { id: string; nombre: string; apellido: string } | null;
  horario: { id: string; fecha: string; hora_inicio: string; hora_fin: string; titulo: string | null; descripcion: string | null } | null;
  solicitud: {
    id: string;
    alumno_id: string;
    profesor_id: string;
    horario_original_id: string;
    fecha_propuesta: string;
    hora_inicio_propuesta: string;
    hora_fin_propuesta: string;
    estado: string;
    motivo_rechazo: string | null;
    nuevo_horario_id: string | null;
    nota_alumno: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  created_at: string;
};

const TIPO_ICON: Record<TipoNotificacion, { icon: React.ElementType; color: string }> = {
  confirmacion:       { icon: CheckCircle2,   color: 'var(--color-success)' },
  cancelacion:        { icon: XCircle,        color: 'var(--color-error)' },
  cambio_horario:     { icon: ArrowLeftRight,  color: 'var(--color-info)' },
  nueva_clase:        { icon: CalendarPlus,   color: 'var(--color-brand-gold)' },
  clase_modificada:   { icon: CalendarClock,  color: 'var(--color-info)' },
  clase_cancelada:    { icon: CalendarOff,    color: 'var(--color-error)' },
  programa_asignado:  { icon: ClipboardList,  color: 'var(--color-brand-gold)' },
  solicitud_cambio_horario: { icon: CalendarClock, color: 'var(--color-info)' },
  cambio_horario_aceptado:  { icon: CheckCircle2,  color: 'var(--color-success)' },
  cambio_horario_rechazado: { icon: XCircle,       color: 'var(--color-error)' },
};

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

function timeAgo(dateStr: string, t: TranslateFn): string {
  const now = new Date();
  const diff = now.getTime() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return t('tiempo.ahora');
  if (mins < 60) return t('tiempo.minutos', { mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('tiempo.horas', { hrs });
  const days = Math.floor(hrs / 24);
  return t('tiempo.dias', { days });
}

async function fetchNotificacionesQuery(): Promise<Notificacion[]> {
  const res = await fetch('/api/notificaciones?page_size=30');
  if (!res.ok) throw new Error('Failed to fetch notificaciones');
  const json = await res.json();
  return Array.isArray(json) ? json : (json.data ?? []);
}

export function NotificacionesPanel() {
  const { user } = useUserStore();
  const { setHorarioDetailId } = useUIStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tn = useTranslations('notificaciones');
  const tv = useTranslations('cambioHorario.vista');
  const locale = useLocale();
  const dateFnsLocale = locale === 'en' ? enUS : es;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudCambio | null>(null);
  const [selectedRechazo, setSelectedRechazo] = useState<SolicitudCambio | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const currentPath = useMemo(() => {
    const qs = searchParams.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, searchParams]);

  const { data: notificaciones = [] } = useQuery<Notificacion[]>({
    queryKey: ['notificaciones'],
    queryFn: fetchNotificacionesQuery,
    staleTime: 30_000,
  });

  const sinLeer = notificaciones.filter((n) => !n.leida).length;

  // Close on click outside
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
  }, [queryClient]);

  const marcarTodo = async () => {
    try {
      await fetch('/api/notificaciones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marcar_todo: true }),
      });
      invalidate();
    } catch { /* ignore */ }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/notificaciones?id=${id}`, { method: 'DELETE' });
      invalidate();
    } catch { /* ignore */ }
  };

  const handleClick = async (n: Notificacion) => {
    if (!n.leida) {
      await fetch('/api/notificaciones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [n.id] }),
      });
      invalidate();
    }

    // Handle solicitud_cambio_horario notification — open modal for profesor
    if (n.tipo === 'solicitud_cambio_horario' && n.solicitud_id && user?.rol === 'profesor') {
      if (n.solicitud) {
        // Build the SolicitudCambio object from the joined data
        const solicitudData: SolicitudCambio = {
          ...n.solicitud,
          estado: n.solicitud.estado as SolicitudCambio['estado'],
          alumno: n.alumno ? { id: n.alumno.id, nombre: n.alumno.nombre, apellido: n.alumno.apellido } : null,
          horario_original: n.horario ? {
            id: n.horario.id,
            titulo: n.horario.titulo || '',
            fecha: n.horario.fecha,
            hora_inicio: n.horario.hora_inicio,
            hora_fin: n.horario.hora_fin,
          } : null,
        };
        setSelectedSolicitud(solicitudData);
        setOpen(false);
        return;
      }
      // Fallback: fetch the solicitud data if not joined
      try {
        const res = await fetch(`/api/solicitudes-cambio?id=${n.solicitud_id}`);
        if (res.ok) {
          const json = await res.json();
          const solicitudes = Array.isArray(json) ? json : (json.data ?? json);
          const solicitud = Array.isArray(solicitudes) ? solicitudes[0] : solicitudes;
          if (solicitud) {
            setSelectedSolicitud(solicitud);
            setOpen(false);
            return;
          }
        }
      } catch { /* fallthrough to default behavior */ }
    }

    // Handle cambio_horario_rechazado notification — open rejection details modal for alumno
    if (n.tipo === 'cambio_horario_rechazado' && n.solicitud_id && user?.rol === 'alumno') {
      if (n.solicitud) {
        const solicitudData: SolicitudCambio = {
          ...n.solicitud,
          estado: n.solicitud.estado as SolicitudCambio['estado'],
          alumno: n.alumno ? { id: n.alumno.id, nombre: n.alumno.nombre, apellido: n.alumno.apellido } : null,
          horario_original: n.horario ? {
            id: n.horario.id,
            titulo: n.horario.titulo || '',
            fecha: n.horario.fecha,
            hora_inicio: n.horario.hora_inicio,
            hora_fin: n.horario.hora_fin,
          } : null,
        };
        setSelectedRechazo(solicitudData);
        setOpen(false);
        return;
      }
      // Fallback: fetch the solicitud data if not joined
      try {
        const res = await fetch(`/api/solicitudes-cambio?id=${n.solicitud_id}`);
        if (res.ok) {
          const json = await res.json();
          const solicitudes = Array.isArray(json) ? json : (json.data ?? json);
          const solicitud = Array.isArray(solicitudes) ? solicitudes[0] : solicitudes;
          if (solicitud) {
            setSelectedRechazo(solicitud);
            setOpen(false);
            return;
          }
        }
      } catch { /* fallthrough to default behavior */ }
    }

    setOpen(false);

    if (n.horario_id) {
      if (user?.rol === 'alumno') {
        router.push(buildAlumnoHorarioDetailHref(n.horario_id, currentPath));
      } else {
        setHorarioDetailId(n.horario_id);
      }
    } else if (n.programa_id && user?.rol === 'alumno') {
      const params = new URLSearchParams();
      params.set('from', currentPath);
      router.push(`/alumno/programas/${n.programa_id}?${params.toString()}`);
    }
  };

  const getNotificationMessage = useCallback((n: Notificacion): string => {
    if (n.tipo === 'confirmacion' || n.tipo === 'cancelacion' || n.tipo === 'cambio_horario' || n.tipo === 'solicitud_cambio_horario') {
      const alumnoNombre = n.alumno
        ? `${n.alumno.nombre} ${n.alumno.apellido}`
        : tn('mensajes.alumno_generico');
      return `${alumnoNombre} ${tn(`tipos.${n.tipo}`)}`;
    }

    // For program assignments use the stored message (contains program name)
    if (n.tipo === 'programa_asignado') {
      return n.mensaje || tn(`tipos.${n.tipo}`);
    }

    const clase = n.horario?.titulo?.trim() || n.horario?.descripcion?.trim() || tn('mensajes.clase_generica');
    const fecha = n.horario
      ? format(
          new Date(`${n.horario.fecha}T12:00:00`),
          locale === 'en' ? 'MMM d' : "d 'de' MMM",
          { locale: dateFnsLocale }
        )
      : '';
    const detalle = [clase, fecha].filter(Boolean).join(' · ');
    const accion = tn(`tipos.${n.tipo}`);
    return detalle ? `${accion}: ${detalle}` : accion;
  }, [tn, locale, dateFnsLocale]);

  return (
    <div ref={panelRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative inline-flex size-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
        aria-label={tn('titulo')}
      >
        <Bell className="size-4" />
        {sinLeer > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-size-4 items-center justify-center rounded-full bg-[var(--color-error)] px-1 text-[10px] font-bold text-white">
            {sinLeer > 9 ? '9+' : sinLeer}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-[var(--container-padding)] right-[var(--container-padding)] top-16 z-50 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg sm:absolute sm:left-auto sm:right-0 sm:top-11 sm:w-96">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
              {tn('titulo')}{sinLeer > 0 ? ` (${sinLeer})` : ''}
            </span>
            {sinLeer > 0 && (
              <button
                onClick={marcarTodo}
                className="flex items-center gap-1 text-xs text-[var(--color-brand-gold)] hover:underline"
              >
                <CheckCheck className="size-3" />
                {tn('marcar_todo')}
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[60vh] divide-y divide-[var(--color-border)] overflow-y-auto sm:max-h-[480px]">
            {notificaciones.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                {tn('sin_notificaciones')}
              </div>
            ) : (
              notificaciones.map((n) => {
                const tipoConfig = TIPO_ICON[n.tipo] ?? { icon: Bell, color: 'var(--color-text-muted)' };
                const IconComponent = tipoConfig.icon;
                return (
                  <div
                    key={n.id}
                    className={`group flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-bg-secondary)] ${!n.leida ? 'bg-[var(--color-brand-gold-muted)]' : ''}`}
                  >
                    {/* Type icon */}
                    <div className="mt-0.5 shrink-0">
                      <IconComponent className="size-4" style={{ color: tipoConfig.color }} />
                    </div>

                    {/* Content — clickable */}
                    <button onClick={() => handleClick(n)} className="min-w-0 flex-1 text-left">
                      <p className={`text-sm leading-snug ${!n.leida ? 'font-medium text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}`}>
                        {getNotificationMessage(n)}
                      </p>

                      {/* Date / time badges */}
                      {n.horario && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                            <Calendar className="size-3" style={{ color: 'var(--color-brand-gold)' }} />
                            <span className="capitalize">
                              {format(
                                new Date(n.horario.fecha + 'T12:00:00'),
                                locale === 'en' ? 'EEE MMM d' : "EEE d 'de' MMM",
                                { locale: dateFnsLocale }
                              )}
                            </span>
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                            <Clock className="h-3 w-3" style={{ color: 'var(--color-brand-gold)' }} />
                            {n.horario.hora_inicio.slice(0, 5)} - {n.horario.hora_fin.slice(0, 5)}
                          </span>
                        </div>
                      )}

                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                        {timeAgo(n.created_at, tn)}
                      </p>
                    </button>

                    {/* Right: unread dot + delete */}
                    <div className="flex shrink-0 flex-col items-center gap-2 pt-0.5">
                      {!n.leida && (
                        <span className="size-2 rounded-full bg-[var(--color-brand-gold)]" />
                      )}
                      <button
                        onClick={(e) => handleDelete(e, n.id)}
                        className="inline-flex size-5 items-center justify-center rounded text-[var(--color-text-muted)] opacity-100 sm:opacity-0 transition-opacity hover:text-[var(--color-error)] sm:group-hover:opacity-100"
                        aria-label={tn('eliminar')}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer — Ver Todo */}
          <div className="border-t border-[var(--color-border)] px-4 py-2">
            <button
              onClick={() => {
                setOpen(false);
                const role = user?.rol ?? 'alumno';
                router.push(`/${role}/notificaciones`);
              }}
              className="w-full py-1.5 text-center text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-brand-gold)]"
            >
              {tv('ver_todo')}
            </button>
          </div>
        </div>
      )}

      {/* Modal for profesor to respond to solicitud_cambio_horario */}
      {selectedSolicitud && (
        <ModalRespuestaSolicitud
          solicitud={selectedSolicitud}
          onClose={() => {
            setSelectedSolicitud(null);
            invalidate();
          }}
        />
      )}

      {/* Modal for alumno to view rejection details */}
      {selectedRechazo && (
        <ModalRechazoDetalle
          solicitud={selectedRechazo}
          onClose={() => setSelectedRechazo(null)}
        />
      )}
    </div>
  );
}
