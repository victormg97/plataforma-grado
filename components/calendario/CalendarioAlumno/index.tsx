'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import type { EventClickArg } from '@fullcalendar/core';
import { useAsistencia } from '@/lib/hooks/useAsistencia';

const ESTADO_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  pendiente:  { bg: 'var(--color-brand-gold)',  border: 'var(--color-brand-gold)',  text: '#1a1a1a' },
  confirmado: { bg: 'var(--color-success)',      border: 'var(--color-success)',      text: '#ffffff' },
  cancelado:  { bg: 'var(--color-error)',        border: 'var(--color-error)',        text: '#ffffff' },
  cambiado:   { bg: 'var(--color-text-muted)',   border: 'var(--color-text-muted)',   text: '#ffffff' },
};

export function CalendarioAlumno() {
  const router = useRouter();
  const { clases, loading } = useAsistencia();
  const [isMobile, setIsMobile] = useState(false);
  const calendarRef = useRef<FullCalendar>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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
      extendedProps: { asistenciaId: c.id, estado: c.estado },
    };
  });

  // Sync events imperatively
  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.removeAllEvents();
    events.forEach((e) => api.addEvent(e));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clases]);

  function handleEventClick(info: EventClickArg) {
    router.push(`/alumno/horario?id=${info.event.id}`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-brand-gold)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="calendario-alumno">
      {/* Legend */}
      <div className="mb-3 flex flex-wrap gap-3">
        {Object.entries(ESTADO_COLORS).map(([estado, colors]) => (
          <div key={estado} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: colors.bg }} />
            <span className="text-xs capitalize text-[var(--color-text-muted)]">{estado}</span>
          </div>
        ))}
      </div>

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
        .calendario-alumno .fc .fc-scrollgrid {
          border-color: var(--color-border);
        }
      `}</style>

      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        locale={esLocale}
        initialView={isMobile ? 'listWeek' : 'dayGridMonth'}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: isMobile ? 'listWeek' : 'dayGridMonth,timeGridWeek,listWeek',
        }}
        events={[]}
        eventClick={handleEventClick}
        eventDisplay="block"
        height="auto"
        aspectRatio={1.8}
        nowIndicator={true}
        weekends={true}
      />
    </div>
  );
}

