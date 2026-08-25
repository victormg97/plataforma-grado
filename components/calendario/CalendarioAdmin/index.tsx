'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import type { EventClickArg, DatesSetArg, EventInput } from '@fullcalendar/core';
import type { DateClickArg } from '@fullcalendar/interaction';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/common/Button';
import { HorarioForm } from '@/components/horarios/HorarioForm';
import { ViewDetailButton } from '@/components/horarios/ViewDetailButton';
import { useTranslations, useLocale } from 'next-intl';
import { Calendar, Clock, FileText, Lock, Pencil, User } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { buildProfesorColorMap, buildProfesorHexMap } from '@/lib/utils/profesorColors';
import { buildClaseDetailHref } from '@/lib/utils/horarioNavigation';
import { CalendarioDownloadButton, type CalendarioExportEvent } from '@/components/calendario/CalendarioDownloadButton';
import { resolveCssVar, getContrastTextColor } from '@/lib/utils/cssTokens';
import { CalendarioStyles } from '@/components/calendario/CalendarioStyles';
import { EventDetailModal } from '@/components/calendario/EventDetailModal';
import { CalendarEventPopover, useCalendarPopover, type PopoverEventData } from '@/components/calendario/CalendarEventPopover';
import { CalendarPersonFilter, ALL_PEOPLE } from '@/components/calendario/CalendarPersonFilter';
import { CalendarioToolbarTooltips } from '@/components/calendario/CalendarioToolbarTooltips';
import { Modal } from '@/components/common/Modal';
import { useBloqueos, type BloqueHorario } from '@/lib/hooks/useBloqueos';
import { useUserStore } from '@/stores/useUserStore';
import { format } from 'date-fns';
import { es as esDateFns, enUS } from 'date-fns/locale';
import { toast } from 'sonner';
import type { EstadoAsistencia } from '@/lib/supabase/types';

// ─── Agenda imports ─────────────────────────────────────────────────────────
import { useEventosAgenda } from '@/lib/agenda/nucleo';
import type { RangoVisible, EventoAgendaProyectado } from '@/lib/agenda/nucleo';
import { useFiltroAgenda, aEventoFullCalendar, aFilaExportacion } from '@/lib/agenda/calendario';
import { FiltroAgenda } from '@/components/agenda/calendario/FiltroAgenda';
import { LeyendaAgenda } from '@/components/agenda/calendario/LeyendaAgenda';
import { DetalleEventoAgenda } from '@/components/agenda/calendario/DetalleEventoAgenda';
import { FormularioAgenda } from '@/components/agenda/FormularioAgenda';

const BLOQUEO_PREFIX = 'bloqueo::';

type HorarioGlobal = {
  id: string;
  profesor_id: string;
  alumno_id: string;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  activo: boolean;
  asistencia: { id: string; estado: EstadoAsistencia; nota_alumno: string | null }[];
  alumno: { id: string; nombre: string; apellido: string; email: string; avatar_url: string | null } | null;
  profesor: { id: string; nombre: string; apellido: string; avatar_url: string | null; color_calendario: string | null } | null;
  pruebas?: { id: string; nota: number | null }[];
  tipo_clase?: string | null;
  simulacion_comision?: { id: string; profesor_id: string; profesor: { id: string; nombre: string; apellido: string; apellido_materno?: string | null; avatar_url: string | null } }[];
};

async function fetchAdminHorarios() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('horarios')
    .select('*, asistencia:asistencia!asistencia_horario_id_fkey(*), alumno:profiles!horarios_alumno_id_fkey(*), profesor:profiles!horarios_profesor_id_fkey(id, nombre, apellido, avatar_url, color_calendario), pruebas:pruebas!pruebas_horario_id_fkey(id, nota), simulacion_comision(id, profesor_id, profesor:profiles!simulacion_comision_profesor_id_fkey(id, nombre, apellido, apellido_materno, avatar_url))')
    .eq('activo', true)
    .order('fecha', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as HorarioGlobal[];
}

export function CalendarioAdmin() {
  const t = useTranslations('horarios');
  const tc = useTranslations('common');
  const locale = useLocale();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: horarios = [] } = useQuery({
    queryKey: ['admin-horarios'],
    queryFn: fetchAdminHorarios,
    staleTime: 30_000,
  });
  const [selectedHorario, setSelectedHorario] = useState<HorarioGlobal | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedBloqueo, setSelectedBloqueo] = useState<BloqueHorario | null>(null);
  const [bloqueoDetailOpen, setBloqueoDetailOpen] = useState(false);
  const [deletingBloqueo, setDeletingBloqueo] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingHorario, setEditingHorario] = useState<HorarioGlobal | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>(undefined);
  const [defaultTime, setDefaultTime] = useState<string | undefined>(undefined);
  const [defaultEndTime, setDefaultEndTime] = useState<string | undefined>(undefined);
  const [defaultBloqueo, setDefaultBloqueo] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [currentView, setCurrentView] = useState('dayGridMonth');
  const [selectedPersonId, setSelectedPersonId] = useState<string>(ALL_PEOPLE);
  const [selectedAgendaEvento, setSelectedAgendaEvento] = useState<EventoAgendaProyectado | null>(null);
  const [agendaDetailOpen, setAgendaDetailOpen] = useState(false);
  const [agendaFormOpen, setAgendaFormOpen] = useState(false);
  const [agendaFormDate, setAgendaFormDate] = useState<string | undefined>(undefined);
  const [agendaFormTime, setAgendaFormTime] = useState<string | undefined>(undefined);
  const [agendaFormEndTime, setAgendaFormEndTime] = useState<string | undefined>(undefined);
  const calendarRef = useRef<FullCalendar>(null);
  const { user } = useUserStore();

  // ─── Agenda: rango visible ──────────────────────────────────────────────
  const [rangoVisible, setRangoVisible] = useState<RangoVisible>(() => {
    const hoy = new Date();
    const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 6);
    return {
      desde: desde.toISOString().slice(0, 10),
      hasta: hasta.toISOString().slice(0, 10),
    };
  });

  // ─── Agenda: filtro y eventos ───────────────────────────────────────────
  const [filtroAgenda] = useFiltroAgenda();
  const { eventos: eventosAgenda } = useEventosAgenda({
    usuarioId: user?.id,
    rango: rangoVisible,
  });

  const { data: adminProfesores = [] } = useQuery<{ id: string; nombre: string; apellido: string; apellido_materno?: string | null; rol?: string }[]>({
    queryKey: ['admin-profesores'],
    queryFn: async () => {
      const r = await fetch('/api/admin/profesores');
      return r.json();
    },
    staleTime: 60_000,
  });

  // Bloqueos de todos los profesores (admin ve todos)
  const { bloqueos, refetch: refetchBloqueos } = useBloqueos();

  // Filtrado por persona seleccionada (Todos por defecto). Los mapas de color
  // se calculan sobre el set completo para que cada profesor conserve su color.
  const filteredHorarios = useMemo(
    () =>
      selectedPersonId === ALL_PEOPLE
        ? horarios
        : horarios.filter((h) => h.profesor_id === selectedPersonId),
    [horarios, selectedPersonId]
  );

  const filteredBloqueos = useMemo(
    () =>
      selectedPersonId === ALL_PEOPLE
        ? bloqueos
        : bloqueos.filter((b) => b.profesor_id === selectedPersonId),
    [bloqueos, selectedPersonId]
  );

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (currentView === 'timeGridWeek') {
      calendarRef.current?.getApi().scrollToTime('08:00:00');
    }
  }, [currentView]);

  useEffect(() => {
    if (!isMobile) return;
    const timer = setTimeout(() => {
      const btn = document.querySelector('.calendario-admin .fc-hoyIcono-button') as HTMLButtonElement | null;
      if (btn) {
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>`;
        btn.style.display = 'inline-flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.lineHeight = '0';
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [isMobile, currentView]);

  // Realtime: invalidate query cache
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('admin-calendar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'horarios' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-horarios'] });
        queryClient.invalidateQueries({ queryKey: ['admin-clases-hoy'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asistencia' }, () => queryClient.invalidateQueries({ queryKey: ['admin-horarios'] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Build color map per professor using their stored colors
  const profesorColorMap = useMemo(() => {
    const uniqueIds = [...new Set(horarios.map((h) => h.profesor_id))];
    const storedColors: Record<string, string | null> = {};
    for (const h of horarios) {
      if (h.profesor && !(h.profesor_id in storedColors)) {
        storedColors[h.profesor_id] = h.profesor.color_calendario;
      }
    }
    return buildProfesorColorMap(uniqueIds, storedColors);
  }, [horarios]);

  // Hex colour map per professor (for PDF export)
  const profesorHexMap = useMemo(() => {
    const uniqueIds = [...new Set(horarios.map((h) => h.profesor_id))];
    const storedColors: Record<string, string | null> = {};
    for (const h of horarios) {
      if (h.profesor && !(h.profesor_id in storedColors)) {
        storedColors[h.profesor_id] = h.profesor.color_calendario;
      }
    }
    return buildProfesorHexMap(uniqueIds, storedColors);
  }, [horarios]);

  // Normalised events for PDF export
  const adminExportEvents = useMemo<CalendarioExportEvent[]>(() => {
    const claseEvents: CalendarioExportEvent[] = filtroAgenda.clases
      ? filteredHorarios.map((h) => ({
          id: h.id,
          title: h.titulo,
          start: new Date(`${h.fecha}T${h.hora_inicio}`),
          end: new Date(`${h.fecha}T${h.hora_fin}`),
          color: profesorHexMap[h.profesor_id] ?? '#C9993F',
          subtitle: h.alumno ? `${h.alumno.nombre} ${h.alumno.apellido}` : undefined,
          status: h.asistencia?.[0]?.estado,
        }))
      : [];

    const agendaExportados: CalendarioExportEvent[] = eventosAgenda
      .filter((ev) => {
        if (ev.tipo === 'entrada_personal' && !filtroAgenda.entradasPersonales) return false;
        if (ev.tipo === 'actividad' && !filtroAgenda.actividades) return false;
        return true;
      })
      .map((ev) => aFilaExportacion(ev, (v) => resolveCssVar(v, '#888888')));

    return [...claseEvents, ...agendaExportados];
  }, [filteredHorarios, profesorHexMap, eventosAgenda, filtroAgenda]);

  // Legend
  const legend = useMemo(() => {
    const seen = new Map<string, { nombre: string; color: string }>();
    for (const h of filteredHorarios) {
      if (h.profesor && !seen.has(h.profesor_id)) {
        seen.set(h.profesor_id, {
          nombre: `${h.profesor.nombre} ${h.profesor.apellido}`,
          color: profesorColorMap[h.profesor_id]?.bg || 'var(--color-text-muted)',
        });
      }
    }
    return [...seen.values()];
  }, [filteredHorarios, profesorColorMap]);

  const events = useMemo(
    () =>
      filteredHorarios.map((h) => {
        // Simulaciones get a special brand-gold color regardless of professor
        const isSimulacion = h.tipo_clase === 'simulacion';
        const colors = isSimulacion
          ? { bg: 'var(--color-brand-gold)', border: 'var(--color-brand-gold)', text: getContrastTextColor('var(--color-brand-gold)') }
          : (profesorColorMap[h.profesor_id] || { bg: 'var(--color-brand-gold)', border: 'var(--color-brand-gold)', text: getContrastTextColor('var(--color-brand-gold)') });
        return {
          id: h.id,
          title: `${h.titulo} - ${h.alumno?.nombre || 'Sin alumno'}`,
          start: `${h.fecha}T${h.hora_inicio}`,
          end: `${h.fecha}T${h.hora_fin}`,
          backgroundColor: colors.bg,
          borderColor: colors.border,
          textColor: colors.text,
          extendedProps: { horario: h },
        };
      }),
    [filteredHorarios, profesorColorMap]
  );

  // ─── Agenda: eventos mapeados a FullCalendar ────────────────────────────
  const agendaFcEvents = useMemo(
    () => eventosAgenda.map(aEventoFullCalendar),
    [eventosAgenda],
  );

  // ─── Eventos combinados con filtro aplicado ─────────────────────────────
  const combinedEvents = useMemo(() => {
    const result: EventInput[] = [];
    if (filtroAgenda.clases) {
      result.push(...events);
    }
    // Agenda events: filter by type
    for (const ev of agendaFcEvents) {
      const tipo = ev.extendedProps.tipo;
      if (tipo === 'entrada_personal' && !filtroAgenda.entradasPersonales) continue;
      if (tipo === 'actividad' && !filtroAgenda.actividades) continue;
      result.push(ev);
    }
    return result;
  }, [events, agendaFcEvents, filtroAgenda]);

  const pruebaHorarioIds = useMemo(
    () => new Set(filteredHorarios.filter((h) => (h.pruebas?.length ?? 0) > 0).map((h) => h.id)),
    [filteredHorarios]
  );

  // Popover on hover (desktop only)
  const { popoverData, popoverAnchor, handleMouseEnter, handleMouseLeave, closePopover } = useCalendarPopover();

  // Imperatively sync events to FullCalendar so the calendar updates
  // immediately after a save or a Supabase Realtime event.
  // Deferred to a microtask to avoid flushSync during React render.
  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    // Use queueMicrotask to avoid "flushSync called from inside a lifecycle method"
    queueMicrotask(() => {
      api.removeAllEvents();
      combinedEvents.forEach((e) => api.addEvent(e));
      // Add bloqueo events with a distinct style
      filteredBloqueos.forEach((b) => {
        api.addEvent({
          id: `${BLOQUEO_PREFIX}${b.id}`,
          title: b.motivo ? `🔒 ${b.motivo}` : '🔒 No disponible',
          start: `${b.fecha}T${b.hora_inicio}`,
          end: `${b.fecha}T${b.hora_fin}`,
          backgroundColor: 'var(--color-bg-elevated, #e5e7eb)',
          borderColor: 'var(--color-border, #d1d5db)',
          textColor: 'var(--color-text-muted, #6b7280)',
          display: 'block',
          extendedProps: { bloqueo: b },
        });
      });
    });
  }, [combinedEvents, filteredBloqueos]);

  function handleEventClick(info: EventClickArg) {
    closePopover();
    if (info.event.id.startsWith(BLOQUEO_PREFIX)) {
      const bloqueo = info.event.extendedProps.bloqueo as BloqueHorario;
      setSelectedBloqueo(bloqueo);
      setBloqueoDetailOpen(true);
      return;
    }
    // Agenda event
    if (info.event.extendedProps.eventoAgendaId) {
      const eventoId = info.event.extendedProps.eventoAgendaId as string;
      const evento = eventosAgenda.find((e) => e.id === eventoId);
      if (evento) {
        setSelectedAgendaEvento(evento);
        setAgendaDetailOpen(true);
      }
      return;
    }
    const horario = info.event.extendedProps.horario as HorarioGlobal;
    setSelectedHorario(horario);
    setDetailOpen(true);
  }

  async function handleDeleteBloqueo() {
    if (!selectedBloqueo) return;
    setDeletingBloqueo(true);
    try {
      const res = await fetch(`/api/bloqueos-horario/${selectedBloqueo.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success(t('bloqueo_eliminado'));
      setBloqueoDetailOpen(false);
      setSelectedBloqueo(null);
      refetchBloqueos();
    } catch {
      toast.error(t('error_eliminar'));
    } finally {
      setDeletingBloqueo(false);
    }
  }

  function handleEditFromDetail() {
    setDetailOpen(false);
    setEditingHorario(selectedHorario);
    setDefaultDate(undefined);
    setDefaultTime(undefined);
    setDefaultEndTime(undefined);
    setDefaultBloqueo(false);
    setFormOpen(true);
  }

  function handleDateClick(info: DateClickArg) {
    setEditingHorario(null);
    setDefaultDate(info.dateStr.slice(0, 10));
    // "Todo el día" row in week/day time-grid views: open as a full-day bloqueo
    // 00:00–23:59. Month view cells are also allDay but must open normally.
    const isTimeGrid = info.view.type === 'timeGridWeek' || info.view.type === 'timeGridDay';
    if (info.allDay && isTimeGrid) {
      setDefaultTime('00:00');
      setDefaultEndTime('23:59');
      setDefaultBloqueo(true);
      setFormOpen(true);
      return;
    }
    const timeMatch = info.dateStr.match(/T(\d{2}:\d{2})/);
    // Open FormularioAgenda instead of HorarioForm for empty range
    setAgendaFormDate(info.dateStr.slice(0, 10));
    setAgendaFormTime(timeMatch ? timeMatch[1] : undefined);
    setAgendaFormEndTime(undefined);
    setAgendaFormOpen(true);
  }

  // ─── Agenda: handle datesSet to update rango ────────────────────────────
  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setCurrentView(arg.view.type);
    const desde = arg.startStr.slice(0, 10);
    const hasta = arg.endStr.slice(0, 10);
    setRangoVisible({ desde, hasta });
  }, []);

  return (
    <>
      {/* Legend row + person filter */}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="order-2 flex flex-wrap gap-3 sm:order-1">
          {legend.map((l) => (
            <div key={l.nombre} className="flex items-center gap-1.5">
              <span className="size-3 rounded-full" style={{ backgroundColor: l.color }} />
              <span className="text-xs text-[var(--color-text-muted)]">{l.nombre}</span>
            </div>
          ))}
        </div>

        {/* Person filter: full width on mobile, compact on desktop */}
        <div className="order-1 flex items-center gap-2 sm:order-2 sm:ml-auto">
          <span className="hidden whitespace-nowrap text-xs text-[var(--color-text-muted)] sm:inline">
            {t('filtro_calendario_label')}
          </span>
          <CalendarPersonFilter
            people={adminProfesores}
            value={selectedPersonId}
            onChange={setSelectedPersonId}
            currentUserId={user?.id}
            className="w-full sm:w-56"
          />
        </div>
      </div>

      {/* Agenda filter + leyenda */}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <FiltroAgenda />
        <LeyendaAgenda eventos={eventosAgenda} />
      </div>

      {/* Download button: desktop injects into FC toolbar, mobile shows popup on view-button tap */}
      <CalendarioDownloadButton
        calendarRef={calendarRef}
        currentView={currentView}
        isMobile={isMobile}
        containerClass=".calendario-admin"
        exportEvents={adminExportEvents}
      />
      <div className="calendario-admin" style={{ overflow: 'hidden' }}>
        <CalendarioStyles containerClass=".calendario-admin" />
        <CalendarioToolbarTooltips
          containerClass=".calendario-admin"
          labels={{
            prev: currentView === 'dayGridMonth' ? t('toolbar_prev_mes') : t('toolbar_prev_semana'),
            next: currentView === 'dayGridMonth' ? t('toolbar_next_mes') : t('toolbar_next_semana'),
            today: t('toolbar_hoy'),
            hoyIcono: t('toolbar_hoy'),
            dayGridMonth: t('toolbar_mes'),
            timeGridWeek: t('toolbar_semana'),
            listWeek: t('toolbar_agenda'),
            nuevaClase: t('toolbar_nueva_clase'),
            descargar: t('toolbar_descargar'),
          }}
          deps={[isMobile, currentView]}
        />
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          locale={locale === 'en' ? undefined : esLocale}
          initialView={isMobile ? 'listWeek' : 'dayGridMonth'}
          headerToolbar={{
            left: isMobile ? 'prev,hoyIcono,next nuevaClase' : 'prev,next today',
            center: 'title',
            right: isMobile ? 'dayGridMonth,timeGridWeek,listWeek' : 'nuevaClase descargar dayGridMonth,timeGridWeek,listWeek',
          }}
          customButtons={{
            nuevaClase: {
              text: `+ ${t('nueva_clase')}`,
              click: () => {
                setEditingHorario(null);
                setAgendaFormDate(undefined);
                setAgendaFormTime(undefined);
                setAgendaFormEndTime(undefined);
                setAgendaFormOpen(true);
              },
            },
            descargar: {
              text: ' ',
              hint: locale === 'es' ? 'Descargar' : 'Download',
              click: () => {},
            },
            hoyIcono: {
              text: ' ',
              hint: tc('hoy'),
              click: () => calendarRef.current?.getApi().today(),
            },
          }}
          events={[]}
          selectable={true}
          editable={false}
          eventClick={handleEventClick}
          eventMouseEnter={(info) => {
            // Bloqueo event — show lock popover
            if (info.event.id.startsWith(BLOQUEO_PREFIX)) {
              const b = info.event.extendedProps.bloqueo as BloqueHorario;
              handleMouseEnter({
                titulo: t('bloqueo_titulo'),
                hora_inicio: b.hora_inicio,
                hora_fin: b.hora_fin,
                estado: 'pendiente' as EstadoAsistencia,
                descripcion: b.motivo ?? null,
                esBloqueo: true,
              }, info.el);
              return;
            }
            const h = info.event.extendedProps.horario as HorarioGlobal;
            const prueba = h.pruebas?.[0];
            const data: PopoverEventData = {
              titulo: h.titulo,
              hora_inicio: h.hora_inicio,
              hora_fin: h.hora_fin,
              estado: (h.asistencia?.[0]?.estado || 'pendiente') as EstadoAsistencia,
              alumno: h.alumno,
              profesor: h.profesor,
              esPrueba: (h.pruebas?.length ?? 0) > 0,
              notaPrueba: prueba?.nota ?? null,
              descripcion: h.descripcion,
              esSimulacion: h.tipo_clase === 'simulacion',
              comisionProfesores: h.tipo_clase === 'simulacion'
                ? h.simulacion_comision?.map(m => m.profesor) ?? []
                : undefined,
            };
            handleMouseEnter(data, info.el);
          }}
          eventMouseLeave={() => handleMouseLeave()}
          dateClick={handleDateClick}
          eventDisplay="block"
          height={currentView === 'timeGridWeek' ? (isMobile ? '65vh' : '78vh') : 'auto'}
          aspectRatio={1.8}
          scrollTime="08:00:00"
          nowIndicator={true}
          weekends={true}
          datesSet={handleDatesSet}
          eventContent={(arg) => {
            const isExam = pruebaHorarioIds.has(arg.event.id);
            // In list view, render title inline (FC handles time + dot separately)
            if (arg.view.type === 'listWeek') {
              return (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{arg.event.title}</span>
                  {isExam && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.8 }}>
                      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                      <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                    </svg>
                  )}
                </span>
              );
            }
            return (
              <div style={{ display: 'flex', alignItems: 'center', width: '100%', overflow: 'hidden', gap: '3px', padding: '0 4px' }}>
                {arg.timeText && (
                  <b style={{ fontSize: '0.65rem', whiteSpace: 'nowrap', flexShrink: 0 }}>{arg.timeText}&nbsp;</b>
                )}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.75rem', fontWeight: 600 }}>
                  {arg.event.title}
                </span>
                {isExam && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.9 }}>
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                    <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                  </svg>
                )}
              </div>
            );
          }}
        />
      </div>

      {/* Event Detail Modal */}
      <EventDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        horario={selectedHorario}
        isExamen={selectedHorario ? (selectedHorario.pruebas?.length ?? 0) > 0 : false}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setDetailOpen(false)}>{tc('cerrar')}</Button>
            <Button onClick={handleEditFromDetail}>
              <Pencil className="mr-1.5 size-4" />
              {t('editar_horario')}
            </Button>
          </div>
        }
        headerSlot={
          selectedHorario?.profesor ? (
            <div className="flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-3">
              <div
                className="flex size-8 items-center justify-center rounded-full"
                style={{ backgroundColor: profesorColorMap[selectedHorario.profesor_id]?.bg || 'var(--color-text-muted)' }}
              >
                <User className="size-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  Prof. {selectedHorario.profesor.nombre} {selectedHorario.profesor.apellido}
                </p>
              </div>
            </div>
          ) : undefined
        }
        bottomSlot={
          selectedHorario ? (
            <ViewDetailButton
              href={buildClaseDetailHref(selectedHorario.id, 'admin', pathname)}
              onClick={() => setDetailOpen(false)}
            />
          ) : undefined
        }
      />

      {/* HorarioForm Modal */}
      <HorarioForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingHorario(null); setDefaultDate(undefined); setDefaultTime(undefined); setDefaultEndTime(undefined); setDefaultBloqueo(false); }}
        profesorId={editingHorario?.profesor_id || (selectedPersonId !== ALL_PEOPLE ? selectedPersonId : '')}
        horario={editingHorario as never}
        defaultDate={defaultDate}
        defaultTime={defaultTime}
        defaultEndTime={defaultEndTime}
        defaultBloqueo={defaultBloqueo}
        adminProfesores={adminProfesores}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['admin-horarios'] })}
      />

      {/* Hover popover (desktop only) */}
      <CalendarEventPopover
        data={popoverData}
        anchorEl={popoverAnchor}
        rol="admin"
        onClose={closePopover}
      />

      {/* Bloqueo detail modal */}
      <Modal
        open={bloqueoDetailOpen}
        onClose={() => setBloqueoDetailOpen(false)}
        title={t('bloqueo_titulo')}
        footer={
          <div className="flex w-full items-center justify-between">
            <Button variant="danger" size="sm" onClick={handleDeleteBloqueo} loading={deletingBloqueo}>
              {tc('eliminar')}
            </Button>
            <Button variant="ghost" onClick={() => setBloqueoDetailOpen(false)}>{tc('cerrar')}</Button>
          </div>
        }
      >
        {selectedBloqueo && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-brand-gold)]/30 bg-[var(--color-brand-gold-muted)] px-3 py-2.5">
              <Lock className="size-4 shrink-0 text-[var(--color-brand-gold)]" />
              <p className="text-sm font-medium text-[var(--color-brand-gold)]">{t('bloqueo_badge')}</p>
            </div>

            {/* Profesor/Admin que creó el bloqueo */}
            {selectedBloqueo.profesor && (
              <div className="flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-3">
                <div
                  className="flex size-8 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: profesorColorMap[selectedBloqueo.profesor_id]?.bg || 'var(--color-text-muted)' }}
                >
                  <User className="size-4 text-white" />
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">{t('bloqueo_creado_por')}</p>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    {[selectedBloqueo.profesor.nombre, selectedBloqueo.profesor.apellido, selectedBloqueo.profesor.apellido_materno].filter(Boolean).join(' ')}
                    {selectedBloqueo.profesor.rol === 'admin' && (
                      <span className="ml-1.5 rounded-full bg-[var(--color-brand-gold-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-brand-gold)]">Admin</span>
                    )}
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">
                <Calendar className="size-3.5" style={{ color: 'var(--color-brand-gold)' }} />
                <span className="capitalize">
                  {format(new Date(selectedBloqueo.fecha + 'T12:00:00'), locale === 'en' ? "EEEE, MMMM d" : "EEEE d 'de' MMMM", { locale: locale === 'en' ? enUS : esDateFns })}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">
                <Clock className="size-3.5" style={{ color: 'var(--color-brand-gold)' }} />
                {selectedBloqueo.hora_inicio.slice(0, 5)} – {selectedBloqueo.hora_fin.slice(0, 5)}
              </span>
            </div>
            {selectedBloqueo.motivo ? (
              <div className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
                <FileText className="mt-0.5 size-4 shrink-0" />
                <p>{selectedBloqueo.motivo}</p>
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">{t('bloqueo_sin_motivo')}</p>
            )}
          </div>
        )}
      </Modal>

      {/* Agenda event detail */}
      <DetalleEventoAgenda
        evento={selectedAgendaEvento}
        open={agendaDetailOpen}
        onClose={() => setAgendaDetailOpen(false)}
        usuarioId={user?.id ?? ''}
      />

      {/* Agenda form (empty range click) */}
      <FormularioAgenda
        open={agendaFormOpen}
        onClose={() => setAgendaFormOpen(false)}
        rol="admin"
        profesorId={selectedPersonId !== ALL_PEOPLE ? selectedPersonId : ''}
        defaultDate={agendaFormDate}
        defaultTime={agendaFormTime}
        defaultEndTime={agendaFormEndTime}
        onSuccess={() => {
          setAgendaFormOpen(false);
          // Invalidate agenda events only — not horarios
          queryClient.invalidateQueries({ queryKey: ['agenda-eventos'] });
        }}
        adminProfesores={adminProfesores}
      />
    </>
  );
}
