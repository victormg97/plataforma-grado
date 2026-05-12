'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell, CheckCircle2, XCircle, ArrowLeftRight,
  CalendarPlus, CalendarClock, CalendarOff, ClipboardList,
  Calendar, Clock, Trash2, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { AppSelect } from '@/components/common/AppSelect';
import { buildAlumnoHorarioDetailHref } from '@/lib/utils/horarioNavigation';
import { useUIStore } from '@/stores/useUIStore';
import { useUserStore } from '@/stores/useUserStore';
import { ModalRespuestaSolicitud } from '@/components/notificaciones/ModalRespuestaSolicitud';
import { ModalRechazoDetalle } from '@/components/notificaciones/ModalRechazoDetalle';
import type { SolicitudCambio } from '@/lib/hooks/useSolicitudesCambio';
import type { TipoNotificacion } from '@/lib/supabase/types';

// ─── Types ────────────────────────────────────────────────────────────────────

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

type PaginatedResponse = {
  data: Notificacion[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

interface NotificacionesFullViewProps {
  role: 'admin' | 'profesor' | 'alumno';
}

// ─── Reused from NotificacionesPanel ──────────────────────────────────────────

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

// (tipos are now fetched dynamically from the API)

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

// ─── Component ────────────────────────────────────────────────────────────────

export function NotificacionesFullView({ role }: NotificacionesFullViewProps) {
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

  // Filter state (applied client-side for instant filtering)
  const [tipoFilter, setTipoFilter] = useState<string>('');
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [alumnoSearch, setAlumnoSearch] = useState<string>('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // Modal state
  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudCambio | null>(null);
  const [selectedRechazo, setSelectedRechazo] = useState<SolicitudCambio | null>(null);

  const currentPath = useMemo(() => {
    const qs = searchParams.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, searchParams]);

  // Fetch ALL notifications once (no filters in API call — filtering is client-side)
  const { data: response, isLoading } = useQuery<PaginatedResponse>({
    queryKey: ['notificaciones-full'],
    queryFn: async () => {
      const res = await fetch('/api/notificaciones?page_size=500');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    staleTime: 30_000,
  });

  const allNotificaciones = response?.data ?? [];

  // Derive available tipos from the actual data
  const availableTipos = useMemo(() => {
    const tipos = [...new Set(allNotificaciones.map((n) => n.tipo))];
    return tipos.sort();
  }, [allNotificaciones]);

  // Apply client-side filters
  const filteredNotificaciones = useMemo(() => {
    let result = allNotificaciones;

    if (tipoFilter) {
      result = result.filter((n) => n.tipo === tipoFilter);
    }

    if (fechaDesde) {
      result = result.filter((n) => n.created_at >= fechaDesde);
    }

    if (fechaHasta) {
      const hastaValue = fechaHasta.includes('T') ? fechaHasta : `${fechaHasta}T23:59:59.999Z`;
      result = result.filter((n) => n.created_at <= hastaValue);
    }

    return result;
  }, [allNotificaciones, tipoFilter, fechaDesde, fechaHasta]);

  // Client-side pagination
  const totalPages = Math.ceil(filteredNotificaciones.length / pageSize);
  const notificaciones = useMemo(() => {
    const from = (page - 1) * pageSize;
    return filteredNotificaciones.slice(from, from + pageSize);
  }, [filteredNotificaciones, page, pageSize]);

  // Build dynamic options for the tipo filter based on what the user actually has
  const tipoOptions = useMemo(() => {
    return availableTipos.map((tipo) => {
      const label = tn(`tipos.${tipo}`);
      return {
        value: tipo,
        label: label.charAt(0).toUpperCase() + label.slice(1),
      };
    });
  }, [availableTipos, tn]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['notificaciones-full'] });
    queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
  }, [queryClient]);

  // Selection helpers
  const allSelected = notificaciones.length > 0 && notificaciones.every((n) => selectedIds.has(n.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notificaciones.map((n) => n.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const ids = [...selectedIds].join(',');
      await fetch(`/api/notificaciones?ids=${ids}`, { method: 'DELETE' });
      setSelectedIds(new Set());
      invalidate();
    } catch { /* ignore */ }
    setDeleting(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/notificaciones?id=${id}`, { method: 'DELETE' });
      invalidate();
    } catch { /* ignore */ }
  };

  const handleClick = async (n: Notificacion) => {
    // Mark as read
    if (!n.leida) {
      await fetch('/api/notificaciones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [n.id] }),
      });
      invalidate();
    }

    // Handle solicitud_cambio_horario — open modal for profesor
    if (n.tipo === 'solicitud_cambio_horario' && n.solicitud_id && user?.rol === 'profesor') {
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
        setSelectedSolicitud(solicitudData);
        return;
      }
      try {
        const res = await fetch(`/api/solicitudes-cambio?id=${n.solicitud_id}`);
        if (res.ok) {
          const json = await res.json();
          const solicitudes = Array.isArray(json) ? json : (json.data ?? json);
          const solicitud = Array.isArray(solicitudes) ? solicitudes[0] : solicitudes;
          if (solicitud) { setSelectedSolicitud(solicitud); return; }
        }
      } catch { /* fallthrough */ }
    }

    // Handle cambio_horario_rechazado — open rejection details for alumno
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
        return;
      }
      try {
        const res = await fetch(`/api/solicitudes-cambio?id=${n.solicitud_id}`);
        if (res.ok) {
          const json = await res.json();
          const solicitudes = Array.isArray(json) ? json : (json.data ?? json);
          const solicitud = Array.isArray(solicitudes) ? solicitudes[0] : solicitudes;
          if (solicitud) { setSelectedRechazo(solicitud); return; }
        }
      } catch { /* fallthrough */ }
    }

    // Default navigation
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

  // Reset page when filters change
  const handleTipoChange = (value: string) => { setTipoFilter(value); setPage(1); setSelectedIds(new Set()); };
  const handleFechaDesdeChange = (value: string) => { setFechaDesde(value); setPage(1); setSelectedIds(new Set()); };
  const handleFechaHastaChange = (value: string) => { setFechaHasta(value); setPage(1); setSelectedIds(new Set()); };
  const handleAlumnoChange = (value: string) => { setAlumnoSearch(value); setPage(1); setSelectedIds(new Set()); };

  // Key that changes when filters change — triggers the fade animation
  const filterKey = `${tipoFilter}-${fechaDesde}-${fechaHasta}-${page}`;

  return (
    <div>
      <PageHeader title={tv('titulo')} />

      {/* Filter bar */}
      <Card padding="md" className="mt-[var(--space-md)]">
        <div className="flex flex-wrap items-end gap-[var(--space-sm)]">
          {/* Tipo filter */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">
              {tv('filtro_tipo')}
            </label>
            <AppSelect
              value={tipoFilter}
              onChange={handleTipoChange}
              options={[
                { value: '', label: tv('filtro_tipo_todas') },
                ...tipoOptions,
              ]}
              placeholder={tv('filtro_tipo_todas')}
              disabled={tipoOptions.length === 0}
              className="min-w-[180px]"
            />
          </div>

          {/* Fecha desde */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">
              {tv('filtro_fecha_desde')}
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => handleFechaDesdeChange(e.target.value)}
              className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]"
            />
          </div>

          {/* Fecha hasta */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">
              {tv('filtro_fecha_hasta')}
            </label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => handleFechaHastaChange(e.target.value)}
              className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]"
            />
          </div>

          {/* Alumno search (admin only) */}
          {role === 'admin' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--color-text-muted)]">
                {tv('filtro_alumno')}
              </label>
              <input
                type="text"
                value={alumnoSearch}
                onChange={(e) => handleAlumnoChange(e.target.value)}
                placeholder={tv('filtro_alumno')}
                className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]"
              />
            </div>
          )}
        </div>
      </Card>

      {/* Selection bar + Notifications list */}
      <Card padding="none" className="mt-[var(--space-md)]">
        {/* Selection toolbar */}
        {notificaciones.length > 0 && (
          <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-2.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="size-4 cursor-pointer rounded border-[var(--color-border)] text-[var(--color-brand-gold)] focus:ring-[var(--color-brand-gold)] accent-[var(--color-brand-gold)]"
              />
              <span className="text-sm text-[var(--color-text-secondary)]">
                {allSelected ? tv('deseleccionar_todo') : tv('seleccionar_todo')}
              </span>
            </label>

            {someSelected && (
              <button
                onClick={handleBatchDelete}
                disabled={deleting}
                className="ml-auto inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-error)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
                {tv('eliminar_seleccionados', { count: selectedIds.size })}
              </button>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="px-4 py-12 text-center text-sm text-[var(--color-text-muted)]">
            <div className="mx-auto size-5 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-brand-gold)]" />
          </div>
        ) : notificaciones.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-[var(--color-text-muted)]">
            {tv('sin_resultados')}
          </div>
        ) : (
          <div key={filterKey} className="divide-y divide-[var(--color-border)] animate-[fadeIn_200ms_ease-out]">
            {notificaciones.map((n) => {
              const tipoConfig = TIPO_ICON[n.tipo] ?? { icon: Bell, color: 'var(--color-text-muted)' };
              const IconComponent = tipoConfig.icon;
              const isSelected = selectedIds.has(n.id);
              return (
                <div
                  key={n.id}
                  className={`group flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-bg-secondary)] ${!n.leida ? 'bg-[var(--color-brand-gold-muted)]' : ''} ${isSelected ? 'bg-[var(--color-brand-gold-muted)]/60' : ''}`}
                >
                  {/* Checkbox */}
                  <div className="mt-0.5 shrink-0 flex items-start">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(n.id)}
                      className="size-4 cursor-pointer rounded border-[var(--color-border)] text-[var(--color-brand-gold)] focus:ring-[var(--color-brand-gold)] accent-[var(--color-brand-gold)]"
                    />
                  </div>

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
            })}
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronLeft className="size-4" />
              {tv('anterior')}
            </button>

            <span className="text-sm text-[var(--color-text-muted)]">
              {tv('pagina_info', { page, total: totalPages })}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-40 disabled:pointer-events-none"
            >
              {tv('siguiente')}
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </Card>

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
