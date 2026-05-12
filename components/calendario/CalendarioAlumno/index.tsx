'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import type { EventClickArg } from '@fullcalendar/core';
import { GraduationCap } from 'lucide-react';
import { useAsistencia } from '@/lib/hooks/useAsistencia';
import { usePruebas } from '@/lib/hooks/usePruebas';
import { buildAlumnoHorarioDetailHref } from '@/lib/utils/horarioNavigation';
import { useTranslations, useLocale } from 'next-intl';
import { CalendarioDownloadButton, type CalendarioExportEvent } from '@/components/calendario/CalendarioDownloadButton';
import { resolveCssVar } from '@/lib/utils/cssTokens';
import { useUserStore } from '@/stores/useUserStore';
import { CalendarEventPopover, useCalendarPopover, type PopoverEventData } from '@/components/calendario/CalendarEventPopover';
import type { EstadoAsistencia } from '@/lib/supabase/types';

const ESTADO_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  pendiente:  { bg: 'var(--color-brand-gold)',  border: 'var(--color-brand-gold)',  text: '#1a1a1a' },
  confirmado: { bg: 'var(--color-success)',      border: 'var(--color-success)',      text: '#ffffff' },
  cancelado:  { bg: 'var(--color-error)',        border: 'var(--color-error)',        text: '#ffffff' },
  cambiado:   { bg: 'var(--color-text-muted)',   border: 'var(--color-text-muted)',   text: '#ffffff' },
};

export function CalendarioAlumno() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { clases, loading } = useAsistencia();
  const { user } = useUserStore();
  const { data: pruebas = [] } = usePruebas(user?.id);
  const tc = useTranslations('common');
  const ta = useTranslations('asistencia');
  const locale = useLocale();
  const [isMobile, setIsMobile] = useState(false);
  const [currentView, setCurrentView] = useState('dayGridMonth');
  const calendarRef = useRef<FullCalendar>(null);
  const currentPath = useMemo(() => {
    const qs = searchParams.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, searchParams]);

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

  const events = clases.map((c) => {
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
  });

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
      return clases.map((c) => ({
        id: c.horario.id,
        title: c.horario.titulo,
        start: new Date(`${c.horario.fecha}T${c.horario.hora_inicio}`),
        end: new Date(`${c.horario.fecha}T${c.horario.hora_fin}`),
        color: estadoHex[c.estado] ?? estadoHex.pendiente,
        subtitle: c.horario.profesor
          ? `${c.horario.profesor.nombre} ${c.horario.profesor.apellido}`
          : undefined,
        status: c.estado,
      }));
    },
    [clases],
  );

  // Sync events imperatively
  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.removeAllEvents();
    events.forEach((e) => api.addEvent(e));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clases]);

  function handleEventClick(info: EventClickArg) {
    closePopover();
    router.push(buildAlumnoHorarioDetailHref(info.event.id, currentPath));
  }

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
          color: var(--color-brand-black) !important;
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
        events={[]}
        eventClick={handleEventClick}
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
      />
    </div>

    {/* Hover popover (desktop only) */}
    <CalendarEventPopover
      data={popoverData}
      anchorEl={popoverAnchor}
      rol="alumno"
      onClose={closePopover}
    />
  </>
  );
}

