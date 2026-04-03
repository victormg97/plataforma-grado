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
import { Modal } from '@/components/common/Modal';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { HorarioForm } from '@/components/horarios/HorarioForm';
import { useTranslations, useLocale } from 'next-intl';
import { Calendar, Clock, FileText, MessageSquare, Pencil, UserX, ExternalLink, GraduationCap } from 'lucide-react';
import { CalendarioDownloadButton, type CalendarioExportEvent } from '@/components/calendario/CalendarioDownloadButton';
import { resolveCssVar } from '@/lib/utils/cssTokens';
import Link from 'next/link';
import { NotasIndicator } from '@/components/notas/NotasIndicator';
import { useNotasCount } from '@/lib/hooks/useNotasCount';
import { buildClaseDetailHref } from '@/lib/utils/horarioNavigation';
import { useUserStore } from '@/stores/useUserStore';
import { format } from 'date-fns';
import { es as esDateFns, enUS } from 'date-fns/locale';
import { toast } from 'sonner';
import { usePruebas } from '@/lib/hooks/usePruebas';

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
  const locale = useLocale();
  const { events, stats, alumnos, rawData, refetch } = useHorarios(profesorId);
  const [selectedHorario, setSelectedHorario] = useState<HorarioConAsistencia | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingHorario, setEditingHorario] = useState<HorarioConAsistencia | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>(undefined);
  const [defaultTime, setDefaultTime] = useState<string | undefined>(undefined);
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
    api.removeAllEvents();
    (events as CalendarEvent[]).forEach((e) => api.addEvent(e));
  }, [events]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNewClassTrigger]);

  function handleEventClick(info: EventClickArg) {
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
    setFormOpen(true);
  }

  function handleDateClick(info: DateClickArg) {
    setEditingHorario(null);
    setDefaultDate(info.dateStr.slice(0, 10));
    // In week/time views, dateStr includes time (e.g. 2026-03-28T10:00:00)
    const timeMatch = info.dateStr.match(/T(\d{2}:\d{2})/);
    setDefaultTime(timeMatch ? timeMatch[1] : undefined);
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
        <style>{`
          .calendario-profesor .fc {
            --fc-border-color: var(--color-border);
            --fc-page-bg-color: var(--color-bg);
            --fc-neutral-bg-color: var(--color-bg-secondary);
            --fc-today-bg-color: color-mix(in srgb, var(--color-brand-gold) 8%, transparent);
            --fc-event-border-color: transparent;
            font-family: var(--font-body);
          }
          .calendario-profesor .fc .fc-toolbar-title {
            font-family: var(--font-display);
            font-size: 1.25rem;
            color: var(--color-text-primary);
            text-transform: capitalize;
          }
          .calendario-profesor .fc .fc-button {
            background: var(--color-bg-secondary);
            border-color: var(--color-border);
            color: var(--color-text-primary);
            font-size: 0.8rem;
            padding: 0.25rem 0.75rem;
            border-radius: var(--radius-md);
            font-weight: 500;
          }
          .calendario-profesor .fc .fc-button:hover {
            background: var(--color-brand-gold-muted);
            border-color: var(--color-brand-gold);
          }
          .calendario-profesor .fc .fc-button-active,
          .calendario-profesor .fc .fc-button.fc-button-active {
            background: var(--color-brand-gold) !important;
            border-color: var(--color-brand-gold) !important;
            color: var(--color-brand-black) !important;
          }
          .calendario-profesor .fc .fc-col-header-cell {
            padding: 0.5rem 0;
            font-weight: 600;
            text-transform: capitalize;
            color: var(--color-text-secondary);
            font-size: 0.8rem;
          }
          .calendario-profesor .fc .fc-daygrid-day-number {
            color: var(--color-text-primary);
            font-size: 0.85rem;
            padding: 4px 8px;
          }
          .calendario-profesor .fc .fc-event {
            border-radius: 6px;
            padding: 2px 6px;
            font-size: 0.75rem;
            cursor: pointer;
            border: none;
          }
          .calendario-profesor .fc .fc-list-event:hover td {
            background: var(--color-bg-secondary);
          }
          .calendario-profesor .fc .fc-list-table {
            table-layout: fixed;
            width: 100%;
          }
          .calendario-profesor .fc .fc-list-event-time {
            width: 5.5rem;
            white-space: nowrap;
          }
          .calendario-profesor .fc .fc-list-event-graphic {
            width: 1.5rem;
          }
          .calendario-profesor .fc .fc-list-event-title {
            overflow: hidden;
          }
          .calendario-profesor .fc .fc-scrollgrid {
            border-color: var(--color-border);
          }
          .calendario-profesor .fc .fc-descargar-button {
            padding: 0.25rem 0.5rem;
          }
          @media (max-width: 640px) {
            .calendario-profesor .fc .fc-toolbar-title {
              font-size: 0.95rem;
            }
            .calendario-profesor .fc .fc-button {
              font-size: 0.7rem;
              padding: 0.2rem 0.45rem;
            }
            .calendario-profesor .fc .fc-toolbar.fc-header-toolbar {
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
          dateClick={handleDateClick}
          datesSet={(arg) => setCurrentView(arg.view.type)}
          eventContent={(arg) => {
            const isExam = pruebaHorarioIds.has(arg.event.id);
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
                <UserX className="mr-1.5 h-4 w-4" />
                {ta('estados.no_asistio')}
              </Button>
            )}
            <Button onClick={handleEditFromDetail}>
              <Pencil className="mr-1.5 h-4 w-4" />
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
                  <GraduationCap className="h-3 w-3" />
                  {t('badge_examen')}
                </span>
              )}
            </div>

            {/* Horario */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">
                <Calendar className="h-3.5 w-3.5" style={{ color: 'var(--color-brand-gold)' }} />
                <span className="capitalize">
                  {format(new Date(selectedHorario.fecha + 'T12:00:00'), locale === 'en' ? "EEEE, MMMM d" : "EEEE d 'de' MMMM", { locale: locale === 'en' ? enUS : esDateFns })}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">
                <Clock className="h-3.5 w-3.5" style={{ color: 'var(--color-brand-gold)' }} />
                {selectedHorario.hora_inicio.slice(0, 5)} - {selectedHorario.hora_fin.slice(0, 5)}
              </span>
            </div>

            {/* Descripcion */}
            {selectedHorario.descripcion && (
              <div className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
                <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{selectedHorario.descripcion}</p>
              </div>
            )}

            {/* Nota del alumno */}
            {selectedHorario.asistencia?.[0]?.nota_alumno && (
              <div className="rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-3">
                <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)]">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {ta('nota_alumno_title')}
                </div>
                <p className="text-sm text-[var(--color-text-primary)]">
                  {selectedHorario.asistencia[0].nota_alumno}
                </p>
              </div>
            )}

            {/* Link to detail page */}
            <Link
              href={buildClaseDetailHref(selectedHorario.id, userRol, `/${userRol}`)}
              className="flex items-center gap-1.5 text-sm text-[var(--color-brand-gold)] hover:underline"
              onClick={() => setDetailOpen(false)}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t('ver_detalle_completo')}
            </Link>
          </div>
        )}
      </Modal>

      {/* HorarioForm Modal */}
      <HorarioForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingHorario(null); setDefaultDate(undefined); setDefaultTime(undefined); }}
        profesorId={profesorId}
        horario={editingHorario}
        defaultDate={defaultDate}
        defaultTime={defaultTime}
        onSuccess={refetch}
        cachedAlumnos={alumnos}
      />
    </>
  );
}
