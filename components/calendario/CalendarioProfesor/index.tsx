'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import type { CalendarEvent } from '@/lib/hooks/useHorarios';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import type { EventClickArg } from '@fullcalendar/core';
import type { DateClickArg } from '@fullcalendar/interaction';
import { useHorarios, type HorarioConAsistencia } from '@/lib/hooks/useHorarios';
import { useBloqueos, type BloqueHorario } from '@/lib/hooks/useBloqueos';
import { Modal } from '@/components/common/Modal';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { HorarioForm } from '@/components/horarios/HorarioForm';
import { useTranslations, useLocale } from 'next-intl';
import { Calendar, Clock, FileText, Lock, MessageSquare, Pencil, UserX, GraduationCap } from 'lucide-react';
import { usePruebaTerm } from '@/lib/hooks/usePruebaTerm';
import { CalendarioDownloadButton, type CalendarioExportEvent } from '@/components/calendario/CalendarioDownloadButton';
import { CalendarioStyles } from '@/components/calendario/CalendarioStyles';
import { resolveCssVar } from '@/lib/utils/cssTokens';
import { NotasIndicator } from '@/components/notas/NotasIndicator';
import { useNotasCount } from '@/lib/hooks/useNotasCount';
import { buildClaseDetailHref } from '@/lib/utils/horarioNavigation';
import { useUserStore } from '@/stores/useUserStore';
import { ViewDetailButton } from '@/components/horarios/ViewDetailButton';
import { format } from 'date-fns';
import { es as esDateFns, enUS } from 'date-fns/locale';
import { toast } from 'sonner';
import { usePruebas } from '@/lib/hooks/usePruebas';
import { CalendarEventPopover, useCalendarPopover, type PopoverEventData } from '@/components/calendario/CalendarEventPopover';
import { CalendarioToolbarTooltips } from '@/components/calendario/CalendarioToolbarTooltips';
import type { EstadoAsistencia } from '@/lib/supabase/types';

// Prefix used to distinguish bloqueo events from horario events in FullCalendar
const BLOQUEO_PREFIX = 'bloqueo::';

interface CalendarioProfesorProps {
  profesorId: string;
  openNewClassTrigger?: number; // increment to trigger new class form from parent
  openHorarioId?: string | null; // open detail modal for this horario id
  onHorarioOpened?: () => void;  // called after opening, so parent can clear the URL param
}

export function CalendarioProfesor({ profesorId, openNewClassTrigger, openHorarioId, onHorarioOpened }: CalendarioProfesorProps) {
  const t = useTranslations('horarios');
  const tc = useTranslations('common');
  const ta = useTranslations('asistencia');
  const pruebaTerm = usePruebaTerm();
  const locale = useLocale();
  const { events, alumnos, rawData, refetch } = useHorarios(profesorId);
  const { bloqueos } = useBloqueos(profesorId);
  const [selectedHorario, setSelectedHorario] = useState<HorarioConAsistencia | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedBloqueo, setSelectedBloqueo] = useState<BloqueHorario | null>(null);
  const [bloqueoDetailOpen, setBloqueoDetailOpen] = useState(false);
  const [deletingBloqueo, setDeletingBloqueo] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingHorario, setEditingHorario] = useState<HorarioConAsistencia | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>(undefined);
  const [defaultTime, setDefaultTime] = useState<string | undefined>(undefined);
  const [defaultEndTime, setDefaultEndTime] = useState<string | undefined>(undefined);
  const [defaultBloqueo, setDefaultBloqueo] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [currentView, setCurrentView] = useState('dayGridMonth');
  const [markingNoAsistio, setMarkingNoAsistio] = useState(false);
  const calendarRef = useRef<FullCalendar>(null);
  const { user } = useUserStore();
  const userRol: 'profesor' | 'admin' = user?.rol === 'admin' ? 'admin' : 'profesor';
  const notasCounts = useNotasCount(selectedHorario ? [selectedHorario.id] : []);

  // Build a Set of horario IDs that are exam classes
  const { data: pruebas = [] } = usePruebas();
  const pruebaHorarioIds = useMemo(
    () => new Set(pruebas.filter((p) => p.horario_id).map((p) => p.horario_id!)),
    [pruebas]
  );

  // Popover on hover (desktop only)
  const { popoverData, popoverAnchor, handleMouseEnter, handleMouseLeave, closePopover } = useCalendarPopover();

  // Estado colour map — resolved at render time from globals.css CSS vars
  const estadoHex: Record<string, string> = {
    pendiente:  resolveCssVar('--color-brand-gold',   '#C9993F'),
    confirmado: resolveCssVar('--color-success',      '#2D6A4F'),
    cancelado:  resolveCssVar('--color-error',        '#C0392B'),
    cambiado:   resolveCssVar('--color-info',         '#2C5F8A'),
    no_asistio: resolveCssVar('--color-text-muted',   '#888888'),
  };

  // Normalised events for PDF export
  const profesorExportEvents = useMemo<CalendarioExportEvent[]>(
    () =>
      rawData.map((h) => ({
        id: h.id,
        title: h.titulo,
        start: new Date(`${h.fecha}T${h.hora_inicio}`),
        end: new Date(`${h.fecha}T${h.hora_fin}`),
        color: estadoHex[h.asistencia?.[0]?.estado ?? 'pendiente'] ?? estadoHex.pendiente,
        subtitle: h.alumno ? `${h.alumno.nombre} ${h.alumno.apellido}` : undefined,
        status: h.asistencia?.[0]?.estado,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawData],
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
      const btn = document.querySelector('.calendario-profesor .fc-hoyIcono-button') as HTMLButtonElement | null;
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

  // Imperatively sync events to FullCalendar so the calendar updates
  // immediately after a save or a Supabase Realtime event — bypassing any
  // prop-change reactivity issues in the FullCalendar React wrapper.
  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    queueMicrotask(() => {
      api.removeAllEvents();
      (events as CalendarEvent[]).forEach((e) => api.addEvent(e));
      // Add bloqueo events with a distinct style
      bloqueos.forEach((b) => {
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
  }, [events, bloqueos]);

  // External trigger: open detail modal for a specific horario (e.g. from a direct URL link).
  // onHorarioOpened clears the URL param immediately so the same link works a second time.
  useEffect(() => {
    if (!openHorarioId || rawData.length === 0) return;
    const horario = rawData.find((h) => h.id === openHorarioId);
    if (horario) {
      setSelectedHorario(horario);
      setDetailOpen(true);
      onHorarioOpened?.();
    }
  // onHorarioOpened is intentionally excluded — it's a stable callback ref
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openHorarioId, rawData]);

  // External trigger: open new class form from parent
  useEffect(() => {
    if (openNewClassTrigger && openNewClassTrigger > 0) {
      handleNewClass();
    }
  }, [openNewClassTrigger]);

  function handleEventClick(info: EventClickArg) {
    closePopover();
    // Check if it's a bloqueo event
    if (info.event.id.startsWith(BLOQUEO_PREFIX)) {
      const bloqueo = info.event.extendedProps.bloqueo as BloqueHorario;
      setSelectedBloqueo(bloqueo);
      setBloqueoDetailOpen(true);
      return;
    }
    const horario = info.event.extendedProps.horario as HorarioConAsistencia;
    setSelectedHorario(horario);
    setDetailOpen(true);
  }

  function handleEditFromDetail() {
    setDetailOpen(false);
    setEditingHorario(selectedHorario);
    setFormOpen(true);
  }

  function handleNewClass() {
    setEditingHorario(null);
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
    // In week/time views, dateStr includes time (e.g. 2026-03-28T10:00:00)
    const timeMatch = info.dateStr.match(/T(\d{2}:\d{2})/);
    setDefaultTime(timeMatch ? timeMatch[1] : undefined);
    setDefaultEndTime(undefined);
    setDefaultBloqueo(false);
    setFormOpen(true);
  }

  async function handleNoAsistio() {
    const asistenciaId = selectedHorario?.asistencia?.[0]?.id;
    if (!asistenciaId) return;
    setMarkingNoAsistio(true);
    try {
      const res = await fetch(`/api/asistencia/${asistenciaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'no_asistio' }),
      });
      if (!res.ok) throw new Error();
      toast.success(t('no_asistio_toast'));
      setDetailOpen(false);
      refetch();
    } catch {
      toast.error(t('error_marcar'));
    } finally {
      setMarkingNoAsistio(false);
    }
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
    } catch {
      toast.error(t('error_eliminar'));
    } finally {
      setDeletingBloqueo(false);
    }
  }

  return (
    <>
      {/* Download button: desktop injects into FC toolbar, mobile shows popup on view-button tap */}
      <CalendarioDownloadButton
        calendarRef={calendarRef}
        currentView={currentView}
        isMobile={isMobile}
        containerClass=".calendario-profesor"
        exportEvents={profesorExportEvents}
      />

      <div className="calendario-profesor" style={{ overflow: 'hidden' }}>
        <CalendarioStyles containerClass=".calendario-profesor" />
        <CalendarioToolbarTooltips
          containerClass=".calendario-profesor"
          labels={{
            prev: t('toolbar_prev'),
            next: t('toolbar_next'),
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
          events={[]}
          eventDisplay="block"
          height={currentView === 'timeGridWeek' ? (isMobile ? '65vh' : '78vh') : 'auto'}
          aspectRatio={1.8}
          scrollTime="08:00:00"
          nowIndicator={true}
          weekends={true}
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
            const h = info.event.extendedProps.horario as HorarioConAsistencia;
            const isPrueba = pruebaHorarioIds.has(h.id);
            const prueba = isPrueba ? pruebas.find((p) => p.horario_id === h.id) : null;
            const data: PopoverEventData = {
              titulo: h.titulo,
              hora_inicio: h.hora_inicio,
              hora_fin: h.hora_fin,
              estado: (h.asistencia?.[0]?.estado || 'pendiente') as EstadoAsistencia,
              alumno: h.alumno,
              esPrueba: isPrueba,
              notaPrueba: prueba?.nota ?? null,
              descripcion: h.descripcion,
            };
            handleMouseEnter(data, info.el);
          }}
          eventMouseLeave={() => handleMouseLeave()}
          dateClick={handleDateClick}
          datesSet={(arg) => setCurrentView(arg.view.type)}
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
          customButtons={{
            nuevaClase: {
              text: `+ ${t('nueva_clase')}`,
              click: handleNewClass,
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
        />
      </div>

      {/* Event Detail Modal */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={selectedHorario?.titulo || t('editar_clase')}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setDetailOpen(false)}>{tc('cerrar')}</Button>
            {selectedHorario?.asistencia?.[0]?.estado === 'confirmado' &&
             selectedHorario.fecha < new Date().toISOString().split('T')[0] && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleNoAsistio}
                loading={markingNoAsistio}
              >
                <UserX className="mr-1.5 size-4" />
                {ta('estados.no_asistio')}
              </Button>
            )}
            <Button onClick={handleEditFromDetail}>
              <Pencil className="mr-1.5 size-4" />
              {t('editar_horario')}
            </Button>
          </div>
        }
      >
        {selectedHorario && (
          <div className="space-y-4">
            {/* Alumno */}
            <div className="flex items-center gap-3">
              <Avatar
                nombre={selectedHorario.alumno?.nombre || ''}
                apellido={selectedHorario.alumno?.apellido || ''}
                avatarUrl={selectedHorario.alumno?.avatar_url}
                size="md"
              />
              <div>
                <p className="font-medium text-[var(--color-text-primary)]">
                  {selectedHorario.alumno?.nombre} {selectedHorario.alumno?.apellido}
                </p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {selectedHorario.alumno?.email}
                </p>
              </div>
            </div>

            {/* Estado */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--color-text-muted)]">{ta('estado_label')}:</span>
              <StatusBadge status={selectedHorario.asistencia?.[0]?.estado || 'pendiente'} />
              <NotasIndicator count={notasCounts[selectedHorario.id] ?? 0} />
              {pruebaHorarioIds.has(selectedHorario.id) && (
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: 'var(--color-brand-gold-muted)', borderColor: 'color-mix(in srgb, var(--color-brand-gold) 40%, transparent)', color: 'var(--color-brand-gold)' }}>
                  <GraduationCap className="size-3" />
                  {t('badge_examen', { term: pruebaTerm.singular })}
                </span>
              )}
            </div>

            {/* Horario */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">
                <Calendar className="size-3.5" style={{ color: 'var(--color-brand-gold)' }} />
                <span className="capitalize">
                  {format(new Date(selectedHorario.fecha + 'T12:00:00'), locale === 'en' ? "EEEE, MMMM d" : "EEEE d 'de' MMMM", { locale: locale === 'en' ? enUS : esDateFns })}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">
                <Clock className="size-3.5" style={{ color: 'var(--color-brand-gold)' }} />
                {selectedHorario.hora_inicio.slice(0, 5)} - {selectedHorario.hora_fin.slice(0, 5)}
              </span>
            </div>

            {/* Descripcion */}
            {selectedHorario.descripcion && (
              <div className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
                <FileText className="mt-0.5 size-4 shrink-0" />
                <p>{selectedHorario.descripcion}</p>
              </div>
            )}

            {/* Nota del alumno */}
            {selectedHorario.asistencia?.[0]?.nota_alumno && (
              <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-3">
                <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)]">
                  <MessageSquare className="size-3.5" />
                  {ta('nota_alumno_title')}
                </div>
                <p className="text-sm text-[var(--color-text-primary)]">
                  {selectedHorario.asistencia[0].nota_alumno}
                </p>
              </div>
            )}

            {/* Link to detail page */}
            <ViewDetailButton
              href={buildClaseDetailHref(selectedHorario.id, userRol, `/${userRol}`)}
              onClick={() => setDetailOpen(false)}
            />
          </div>
        )}
      </Modal>

      {/* HorarioForm Modal */}
      <HorarioForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingHorario(null); setDefaultDate(undefined); setDefaultTime(undefined); setDefaultEndTime(undefined); setDefaultBloqueo(false); }}
        profesorId={profesorId}
        horario={editingHorario}
        defaultDate={defaultDate}
        defaultTime={defaultTime}
        defaultEndTime={defaultEndTime}
        defaultBloqueo={defaultBloqueo}
        onSuccess={refetch}
        cachedAlumnos={alumnos}
      />

      {/* Hover popover (desktop only) */}
      <CalendarEventPopover
        data={popoverData}
        anchorEl={popoverAnchor}
        rol={userRol}
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
              <div className="flex items-center gap-3">
                <Avatar
                  nombre={selectedBloqueo.profesor.nombre}
                  apellido={selectedBloqueo.profesor.apellido}
                  avatarUrl={selectedBloqueo.profesor.avatar_url}
                  size="sm"
                />
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
    </>
  );
}
