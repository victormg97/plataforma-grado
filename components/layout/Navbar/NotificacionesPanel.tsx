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
  alumno: { id: string; nombre: string; apellido: string } | null;
  horario: { id: string; fecha: string; hora_inicio: string; hora_fin: string; titulo: string | null; descripcion: string | null } | null;
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
  const res = await fetch('/api/notificaciones?limit=30');
  if (!res.ok) throw new Error('Failed to fetch notificaciones');
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export function NotificacionesPanel() {
  const { user } = useUserStore();
  const { setHorarioDetailId } = useUIStore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tn = useTranslations('notificaciones');
  const locale = useLocale();
  const dateFnsLocale = locale === 'en' ? enUS : es;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
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
    if (n.tipo === 'confirmacion' || n.tipo === 'cancelacion' || n.tipo === 'cambio_horario') {
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
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
        aria-label={tn('titulo')}
      >
        <Bell className="h-4 w-4" />
        {sinLeer > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-error)] px-1 text-[10px] font-bold text-white">
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
                <CheckCheck className="h-3 w-3" />
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
                      <IconComponent className="h-4 w-4" style={{ color: tipoConfig.color }} />
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
                            <Calendar className="h-3 w-3" style={{ color: 'var(--color-brand-gold)' }} />
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
                        <span className="h-2 w-2 rounded-full bg-[var(--color-brand-gold)]" />
                      )}
                      <button
                        onClick={(e) => handleDelete(e, n.id)}
                        className="inline-flex h-5 w-5 items-center justify-center rounded text-[var(--color-text-muted)] opacity-0 transition-opacity hover:text-[var(--color-error)] group-hover:opacity-100"
                        aria-label={tn('eliminar')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
