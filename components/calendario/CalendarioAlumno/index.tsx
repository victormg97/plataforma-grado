'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import type { EventClickArg, DatesSetArg, EventInput } from '@fullcalendar/core';
import type { DateClickArg } from '@fullcalendar/interaction';
import { useAsistencia } from '@/lib/hooks/useAsistencia';
import type { ClaseAlumno } from '@/lib/hooks/useAsistencia';
import { usePruebas } from '@/lib/hooks/usePruebas';
import { buildAlumnoHorarioDetailHref } from '@/lib/utils/horarioNavigation';
import { useTranslations, useLocale } from 'next-intl';
import { CalendarioDownloadButton, type CalendarioExportEvent } from '@/components/calendario/CalendarioDownloadButton';
import { resolveCssVar } from '@/lib/utils/cssTokens';
import { useUserStore } from '@/stores/useUserStore';
import { CalendarEventPopover, useCalendarPopover, type PopoverEventData } from '@/components/calendario/CalendarEventPopover';
import type { EstadoAsistencia } from '@/lib/supabase/types';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { StatusBadge } from '@/components/common/StatusBadge';
import { RichDescription } from '@/components/common/RichDescription';
import { ViewDetailButton } from '@/components/horarios/ViewDetailButton';
import { Calendar, Clock, User, GraduationCap } from 'lucide-react';
import { format } from 'date-fns';
import { es as esDateFns, enUS } from 'date-fns/locale';

// ─── Agenda imports ─────────────────────────────────────────────────────────
import { useEventosAgenda } from '@/lib/agenda/nucleo';
import type { RangoVisible, EventoAgendaProyectado } from '@/lib/agenda/nucleo';
import { useFiltroAgenda, aEventoFullCalendar, aFilaExportacion } from '@/lib/agenda/calendario';
import { useActividadesOcultas } from '@/lib/agenda/ocultacion';
import { FiltroAgenda } from '@/components/agenda/calendario/FiltroAgenda';
import { LeyendaAgenda } from '@/components/agenda/calendario/LeyendaAgenda';
import { DetalleEventoAgenda } from '@/components/agenda/calendario/DetalleEventoAgenda';
import { FormularioAgenda } from '@/components/agenda/FormularioAgenda';
import { FormularioEntradaPersonal } from '@/components/agenda/entradas-personales/FormularioEntradaPersonal';
import { PanelActividadesOcultas } from '@/components/agenda/ocultacion/PanelActividadesOcultas';
import { toast } from 'sonner';

const ESTADO_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  pendiente:  { bg: 'var(--color-brand-gold)',  border: 'var(--color-brand-gold)',  text: '#1a1a1a' },
  confirmado: { bg: 'var(--color-success)',      border: 'var(--color-success)',      text: '#ffffff' },
  cancelado:  { bg: 'var(--color-error)',        border: 'var(--color-error)',        text: '#ffffff' },
  cambiado:   { bg: 'var(--color-text-muted)',   border: 'var(--color-text-muted)',   text: '#ffffff' },
};

export function CalendarioAlumno() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { clases, loading } = useAsistencia();
  const { user } = useUserStore();
  const { data: pruebas = [] } = usePruebas(user?.id);
  const tc = useTranslations('common');
  const ta = useTranslations('asistencia');
  const tEp = useTranslations('agendaEntradasPersonales');
  const locale = useLocale();
  const [isMobile, setIsMobile] = useState(false);
  const [currentView, setCurrentView] = useState('dayGridMonth');
  const calendarRef = useRef<FullCalendar>(null);
  const currentPath = useMemo(() => {
    const qs = searchParams.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, searchParams]);

  const queryClient = useQueryClient();

  // ─── Agenda state ───────────────────────────────────────────────────────
  const [selectedAgendaEvento, setSelectedAgendaEvento] = useState<EventoAgendaProyectado | null>(null);
  const [agendaDetailOpen, setAgendaDetailOpen] = useState(false);
  const [agendaFormOpen, setAgendaFormOpen] = useState(false);
  const [agendaEditOpen, setAgendaEditOpen] = useState(false);

  // ─── Class detail modal state ───────────────────────────────────────────
  const [selectedClase, setSelectedClase] = useState<ClaseAlumno | null>(null);
  const [claseDetailOpen, setClaseDetailOpen] = useState(false);
  const [agendaFormDate, setAgendaFormDate] = useState<string | undefined>(undefined);
  const [agendaFormTime, setAgendaFormTime] = useState<string | undefined>(undefined);
  const [agendaFormEndTime, setAgendaFormEndTime] = useState<string | undefined>(undefined);

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

  // ─── Agenda: actividades ocultas ───────────────────────────────────────
  const { ocultas } = useActividadesOcultas({ usuarioId: user?.id, rango: rangoVisible });
  const ocultaIds = useMemo(() => new Set(ocultas.map((o) => o.eventoId)), [ocultas]);

  const pruebaHorarioIds = useMemo(
    () => new Set(pruebas.filter((p) => p.horario_id).map((p) => p.horario_id!)),
    [pruebas]
  );

  // Popover on hover (desktop only)
  const { popoverData, popoverAnchor, handleMouseEnter, handleMouseLeave, closePopover } = useCalendarPopover();

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
      const btn = document.querySelector('.calendario-alumno .fc-hoyIcono-button') as HTMLButtonElement | null;
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

  const events = useMemo(() => clases.map((c) => {
    const colors = ESTADO_COLORS[c.estado] || ESTADO_COLORS.pendiente;
    return {
      id: c.horario.id,
      title: c.horario.titulo,
      start: `${c.horario.fecha}T${c.horario.hora_inicio}`,
      end: `${c.horario.fecha}T${c.horario.hora_fin}`,
      backgroundColor: colors.bg,
      borderColor: colors.border,
      textColor: colors.text,
      extendedProps: { asistenciaId: c.id, estado: c.estado, clase: c },
    };
  }), [clases]);

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
    for (const ev of agendaFcEvents) {
      const tipo = ev.extendedProps.tipo;
      if (tipo === 'entrada_personal' && !filtroAgenda.entradasPersonales) continue;
      if (tipo === 'actividad' && !filtroAgenda.actividades) continue;
      // Excluir actividades ocultas por el alumno (Requisito 9.11)
      if (ev.extendedProps.eventoAgendaId && ocultaIds.has(ev.extendedProps.eventoAgendaId as string)) continue;
      result.push(ev);
    }
    return result;
  }, [events, agendaFcEvents, filtroAgenda, ocultaIds]);

  // Normalised events for PDF export
  const alumnoExportEvents = useMemo<CalendarioExportEvent[]>(
    () => {
      const estadoHex: Record<string, string> = {
        pendiente:  resolveCssVar('--color-brand-gold',  '#C9993F'),
        confirmado: resolveCssVar('--color-success',     '#2D6A4F'),
        cancelado:  resolveCssVar('--color-error',       '#C0392B'),
        cambiado:   resolveCssVar('--color-info',        '#2C5F8A'),
        no_asistio: resolveCssVar('--color-text-muted',  '#888888'),
      };

      const claseEvents: CalendarioExportEvent[] = filtroAgenda.clases
        ? clases.map((c) => ({
            id: c.horario.id,
            title: c.horario.titulo,
            start: new Date(`${c.horario.fecha}T${c.horario.hora_inicio}`),
            end: new Date(`${c.horario.fecha}T${c.horario.hora_fin}`),
            color: estadoHex[c.estado] ?? estadoHex.pendiente,
            subtitle: c.horario.profesor
              ? `${c.horario.profesor.nombre} ${c.horario.profesor.apellido}`
              : undefined,
            status: c.estado,
          }))
        : [];

      const agendaExportados: CalendarioExportEvent[] = eventosAgenda
        .filter((ev) => {
          if (ev.tipo === 'entrada_personal' && !filtroAgenda.entradasPersonales) return false;
          if (ev.tipo === 'actividad' && !filtroAgenda.actividades) return false;
          // Excluir actividades ocultas del PDF (Requisito 9.11)
          if (ocultaIds.has(ev.id)) return false;
          return true;
        })
        .map((ev) => aFilaExportacion(ev, (v) => resolveCssVar(v, '#888888')));

      return [...claseEvents, ...agendaExportados];
    },
    [clases, eventosAgenda, filtroAgenda, ocultaIds],
  );

  // No imperative sync needed — events are passed declaratively via the events prop

  function handleEventClick(info: EventClickArg) {
    closePopover();
    // Class event — open detail modal
    if (info.event.extendedProps.asistenciaId) {
      const clase = info.event.extendedProps.clase as ClaseAlumno;
      if (clase) {
        setSelectedClase(clase);
        setClaseDetailOpen(true);
      }
      return;
    }
    // Agenda event (entrada personal or actividad)
    if (info.event.extendedProps.eventoAgendaId) {
      const eventoId = info.event.extendedProps.eventoAgendaId as string;
      const evento = eventosAgenda.find((e) => e.id === eventoId);
      if (evento) {
        setSelectedAgendaEvento(evento);
        setAgendaDetailOpen(true);
      }
      return;
    }
  }

  // ─── Agenda: dateClick opens FormularioAgenda in entrada_personal mode ──
  function handleDateClick(info: DateClickArg) {
    const timeMatch = info.dateStr.match(/T(\d{2}:\d{2})/);
    setAgendaFormDate(info.dateStr.slice(0, 10));
    setAgendaFormTime(timeMatch ? timeMatch[1] : undefined);
    setAgendaFormEndTime(undefined);
    setAgendaFormOpen(true);
  }

  // ─── Agenda: edit personal entry ────────────────────────────────────────
  function handleAgendaEditar() {
    if (!selectedAgendaEvento || selectedAgendaEvento.tipo !== 'entrada_personal') return;
    setAgendaDetailOpen(false);
    setAgendaEditOpen(true);
  }

  // ─── Agenda: delete personal entry ──────────────────────────────────────
  async function handleAgendaEliminar() {
    if (!selectedAgendaEvento || selectedAgendaEvento.tipo !== 'entrada_personal') return;
    try {
      const res = await fetch(`/api/agenda/entradas-personales/${selectedAgendaEvento.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      toast.success(tEp('exito_eliminado'));
      queryClient.invalidateQueries({ queryKey: ['agenda-eventos'] });
      setAgendaDetailOpen(false);
      setSelectedAgendaEvento(null);
    } catch {
      toast.error(tEp('error_eliminar'));
    }
  }

  // ─── Agenda: handle datesSet to update rango ────────────────────────────
  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setCurrentView(arg.view.type);
    const desde = arg.startStr.slice(0, 10);
    const hasta = arg.endStr.slice(0, 10);
    setRangoVisible({ desde, hasta });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="size-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
      </div>
    );
  }

  return (
  <>
    <div className="calendario-alumno" style={{ overflow: 'hidden' }}>
      {/* Legend row */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-3">
          {Object.entries(ESTADO_COLORS).map(([estado, colors]) => (
            <div key={estado} className="flex items-center gap-1.5">
              <span className="size-3 rounded-full" style={{ backgroundColor: colors.bg }} />
              <span className="text-xs capitalize text-[var(--color-text-muted)]">{ta(`estados.${estado}`)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Agenda filter + leyenda */}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <FiltroAgenda />
        <LeyendaAgenda eventos={eventosAgenda} />
      </div>

      {/* Actividades ocultas panel */}
      <PanelActividadesOcultas rango={rangoVisible} usuarioId={user?.id} />

      <CalendarioDownloadButton
        calendarRef={calendarRef}
        currentView={currentView}
        isMobile={isMobile}
        containerClass=".calendario-alumno"
        exportEvents={alumnoExportEvents}
      />

      <style>{`
        .calendario-alumno .fc {
          --fc-border-color: var(--color-border);
          --fc-page-bg-color: var(--color-bg);
          --fc-neutral-bg-color: var(--color-bg-secondary);
          --fc-today-bg-color: color-mix(in srgb, var(--color-brand-gold) 8%, transparent);
          font-family: var(--font-body);
        }
        .calendario-alumno .fc .fc-toolbar-title {
          font-family: var(--font-display);
          font-size: 1.25rem;
          color: var(--color-text-primary);
          text-transform: capitalize;
        }
        .calendario-alumno .fc .fc-button {
          background: var(--color-bg-secondary);
          border-color: var(--color-border);
          color: var(--color-text-primary);
          font-size: 0.8rem;
          padding: 0.25rem 0.75rem;
          border-radius: var(--radius-md);
          font-weight: 500;
        }
        .calendario-alumno .fc .fc-button:hover {
          background: var(--color-brand-gold-muted);
          border-color: var(--color-brand-gold);
        }
        .calendario-alumno .fc .fc-button-active,
        .calendario-alumno .fc .fc-button.fc-button-active {
          background: var(--color-brand-gold) !important;
          border-color: var(--color-brand-gold) !important;
          color: var(--accent-foreground) !important;
        }
        .calendario-alumno .fc .fc-descargar-button { padding: 0.25rem 0.5rem; }
        .calendario-alumno .fc .fc-col-header-cell {
          padding: 0.5rem 0;
          font-weight: 600;
          text-transform: capitalize;
          color: var(--color-text-secondary);
          font-size: 0.8rem;
        }
        .calendario-alumno .fc .fc-daygrid-day-number {
          color: var(--color-text-primary);
          font-size: 0.85rem;
          padding: 4px 8px;
        }
        .calendario-alumno .fc .fc-event {
          border-radius: 6px;
          padding: 2px 6px;
          font-size: 0.75rem;
          cursor: pointer;
          border: none;
        }
        .calendario-alumno .fc .fc-list-event:hover td {
          background: var(--color-bg-secondary);
        }
        .calendario-alumno .fc .fc-list-event-title {
          overflow: hidden;
        }
        .calendario-alumno .fc .fc-scrollgrid {
          border-color: var(--color-border);
        }
        @media (max-width: 640px) {
          .calendario-alumno .fc .fc-toolbar-title {
            font-size: 0.95rem;
          }
          .calendario-alumno .fc .fc-button {
            font-size: 0.7rem;
            padding: 0.2rem 0.45rem;
          }
          .calendario-alumno .fc .fc-toolbar.fc-header-toolbar {
            gap: 0.35rem;
          }
        }
      `}</style>

      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        locale={locale === 'en' ? undefined : esLocale}
        initialView={isMobile ? 'listWeek' : 'dayGridMonth'}
        headerToolbar={{
          left: isMobile ? 'prev,hoyIcono,next' : 'prev,next today',
          center: 'title',
          right: 'descargar dayGridMonth,timeGridWeek,listWeek',
        }}
        customButtons={{
          hoyIcono: {
            text: ' ',
            hint: tc('hoy'),
            click: () => calendarRef.current?.getApi().today(),
          },
          descargar: { text: ' ', hint: locale === 'es' ? 'Descargar' : 'Download', click: () => {} },
        }}
        events={combinedEvents}
        eventClick={handleEventClick}
        dateClick={handleDateClick}
        selectable={true}
        eventMouseEnter={(info) => {
          const c = info.event.extendedProps.clase;
          if (!c) return;
          const isPrueba = pruebaHorarioIds.has(c.horario.id);
          const prueba = isPrueba ? pruebas.find((p) => p.horario_id === c.horario.id) : null;
          const data: PopoverEventData = {
            titulo: c.horario.titulo,
            hora_inicio: c.horario.hora_inicio,
            hora_fin: c.horario.hora_fin,
            estado: c.estado as EstadoAsistencia,
            profesor: c.horario.profesor,
            esPrueba: isPrueba,
            notaPrueba: prueba?.nota ?? null,
            descripcion: c.horario.descripcion,
            esSimulacion: c.horario.tipo_clase === 'simulacion',
          };
          handleMouseEnter(data, info.el);
        }}
        eventMouseLeave={() => handleMouseLeave()}
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

    {/* Hover popover (desktop only) */}
    <CalendarEventPopover
      data={popoverData}
      anchorEl={popoverAnchor}
      rol="alumno"
      onClose={closePopover}
    />

    {/* Class detail modal (alumno) */}
    <Modal
      open={claseDetailOpen}
      onClose={() => setClaseDetailOpen(false)}
      title={selectedClase?.horario.titulo || tc('detalle')}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setClaseDetailOpen(false)}>{tc('cerrar')}</Button>
        </div>
      }
    >
      {selectedClase && (
        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--color-text-muted)]">{ta('estado_label')}:</span>
            <StatusBadge status={selectedClase.estado} />
            {selectedClase.horario.tipo_clase === 'simulacion' && (
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: 'var(--color-brand-gold-muted)', borderColor: 'color-mix(in srgb, var(--color-brand-gold) 40%, transparent)', color: 'var(--color-brand-gold)' }}>
                <GraduationCap className="size-3" />
                {locale === 'en' ? 'Simulation' : 'Simulación'}
              </span>
            )}
          </div>

          {/* Date & time */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">
              <Calendar className="size-3.5" style={{ color: 'var(--color-brand-gold)' }} />
              <span className="capitalize">
                {format(new Date(selectedClase.horario.fecha + 'T12:00:00'), locale === 'en' ? "EEEE, MMMM d" : "EEEE d 'de' MMMM", { locale: locale === 'en' ? enUS : esDateFns })}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">
              <Clock className="size-3.5" style={{ color: 'var(--color-brand-gold)' }} />
              {selectedClase.horario.hora_inicio.slice(0, 5)} - {selectedClase.horario.hora_fin.slice(0, 5)}
            </span>
          </div>

          {/* Professor */}
          {selectedClase.horario.profesor && (
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <User className="size-4 shrink-0 text-[var(--color-brand-gold)]" />
              <span>Prof. {selectedClase.horario.profesor.nombre} {selectedClase.horario.profesor.apellido}</span>
            </div>
          )}

          {/* Description */}
          {selectedClase.horario.descripcion && (
            <RichDescription html={selectedClase.horario.descripcion} />
          )}

          {/* Link to full detail page */}
          <ViewDetailButton
            href={buildAlumnoHorarioDetailHref(selectedClase.horario.id, currentPath)}
            onClick={() => setClaseDetailOpen(false)}
          />
        </div>
      )}
    </Modal>

    {/* Agenda event detail */}
    <DetalleEventoAgenda
      evento={selectedAgendaEvento}
      open={agendaDetailOpen}
      onClose={() => setAgendaDetailOpen(false)}
      onEditar={handleAgendaEditar}
      onEliminar={handleAgendaEliminar}
      usuarioId={user?.id ?? ''}
    />

    {/* Agenda edit form for personal entries */}
    <FormularioEntradaPersonal
      open={agendaEditOpen}
      onClose={() => { setAgendaEditOpen(false); setSelectedAgendaEvento(null); }}
      entradaExistente={
        selectedAgendaEvento && selectedAgendaEvento.tipo === 'entrada_personal' && selectedAgendaEvento.lectura === 'completa'
          ? {
              id: selectedAgendaEvento.id,
              titulo: selectedAgendaEvento.titulo,
              categoria: selectedAgendaEvento.categoria,
              visibilidad: selectedAgendaEvento.visibilidad as 'privada' | 'publica',
              fecha: selectedAgendaEvento.fecha,
              hora_inicio: selectedAgendaEvento.hora_inicio,
              hora_fin: selectedAgendaEvento.hora_fin,
              dia_completo: selectedAgendaEvento.dia_completo,
              descripcion: selectedAgendaEvento.descripcion,
              nota: selectedAgendaEvento.nota,
              lugar: selectedAgendaEvento.lugar,
              enlace_conexion: selectedAgendaEvento.enlace_conexion,
            }
          : null
      }
      rol="alumno"
      onSuccess={() => {
        setAgendaEditOpen(false);
        setSelectedAgendaEvento(null);
        queryClient.invalidateQueries({ queryKey: ['agenda-eventos'] });
      }}
    />

    {/* Agenda form (empty range click) — always entrada_personal for alumno */}
    <FormularioAgenda
      open={agendaFormOpen}
      onClose={() => setAgendaFormOpen(false)}
      rol="alumno"
      profesorId=""
      defaultDate={agendaFormDate}
      defaultTime={agendaFormTime}
      defaultEndTime={agendaFormEndTime}
      onSuccess={() => {
        setAgendaFormOpen(false);
        queryClient.invalidateQueries({ queryKey: ['agenda-eventos'] });
      }}
    />
  </>
  );
}

