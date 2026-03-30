'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import type { EventClickArg } from '@fullcalendar/core';
import type { DateClickArg } from '@fullcalendar/interaction';
import { createClient } from '@/lib/supabase/client';
import { Modal } from '@/components/common/Modal';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { HorarioForm } from '@/components/horarios/HorarioForm';
import { useTranslations, useLocale } from 'next-intl';
import { Clock, FileText, MessageSquare, Pencil, User } from 'lucide-react';
import type { EstadoAsistencia } from '@/lib/supabase/types';

const PROFESOR_COLORS = [
  { bg: 'var(--color-profe-1)', border: 'var(--color-profe-1)', text: 'var(--color-brand-black)' },
  { bg: 'var(--color-profe-2)', border: 'var(--color-profe-2)', text: 'var(--color-brand-white)' },
  { bg: 'var(--color-profe-3)', border: 'var(--color-profe-3)', text: 'var(--color-brand-white)' },
  { bg: 'var(--color-profe-4)', border: 'var(--color-profe-4)', text: 'var(--color-brand-white)' },
  { bg: 'var(--color-profe-5)', border: 'var(--color-profe-5)', text: 'var(--color-brand-white)' },
  { bg: 'var(--color-profe-6)', border: 'var(--color-profe-6)', text: 'var(--color-brand-white)' },
  { bg: 'var(--color-profe-7)', border: 'var(--color-profe-7)', text: 'var(--color-brand-white)' },
];

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
  profesor: { id: string; nombre: string; apellido: string; avatar_url: string | null } | null;
};

async function fetchAdminHorarios() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('horarios')
    .select('*, asistencia:asistencia!asistencia_horario_id_fkey(*), alumno:profiles!horarios_alumno_id_fkey(*), profesor:profiles!horarios_profesor_id_fkey(id, nombre, apellido, avatar_url)')
    .eq('activo', true)
    .order('fecha', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as HorarioGlobal[];
}

export function CalendarioAdmin() {
  const t = useTranslations('horarios');
  const tc = useTranslations('common');
  const ta = useTranslations('asistencia');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { data: horarios = [] } = useQuery({
    queryKey: ['admin-horarios'],
    queryFn: fetchAdminHorarios,
    staleTime: 30_000,
  });
  const [selectedHorario, setSelectedHorario] = useState<HorarioGlobal | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingHorario, setEditingHorario] = useState<HorarioGlobal | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>(undefined);
  const [defaultTime, setDefaultTime] = useState<string | undefined>(undefined);
  const [isMobile, setIsMobile] = useState(false);
  const [currentView, setCurrentView] = useState('dayGridMonth');
  const calendarRef = useRef<FullCalendar>(null);

  const { data: adminProfesores = [] } = useQuery<{ id: string; nombre: string; apellido: string }[]>({
    queryKey: ['admin-profesores'],
    queryFn: async () => {
      const r = await fetch('/api/admin/profesores');
      return r.json();
    },
    staleTime: 60_000,
  });

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'horarios' }, () => queryClient.invalidateQueries({ queryKey: ['admin-horarios'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asistencia' }, () => queryClient.invalidateQueries({ queryKey: ['admin-horarios'] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Build color map per professor
  const profesorColorMap = useMemo(() => {
    const uniqueIds = [...new Set(horarios.map((h) => h.profesor_id))];
    const map: Record<string, typeof PROFESOR_COLORS[0]> = {};
    uniqueIds.forEach((id, i) => {
      map[id] = PROFESOR_COLORS[i % PROFESOR_COLORS.length];
    });
    return map;
  }, [horarios]);

  // Legend
  const legend = useMemo(() => {
    const seen = new Map<string, { nombre: string; color: string }>();
    for (const h of horarios) {
      if (h.profesor && !seen.has(h.profesor_id)) {
        seen.set(h.profesor_id, {
          nombre: `${h.profesor.nombre} ${h.profesor.apellido}`,
          color: profesorColorMap[h.profesor_id]?.bg || 'var(--color-text-muted)',
        });
      }
    }
    return [...seen.values()];
  }, [horarios, profesorColorMap]);

  const events = useMemo(
    () =>
      horarios.map((h) => {
        const colors = profesorColorMap[h.profesor_id] || PROFESOR_COLORS[0];
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
    [horarios, profesorColorMap]
  );

  // Imperatively sync events to FullCalendar so the calendar updates
  // immediately after a save or a Supabase Realtime event.
  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.removeAllEvents();
    events.forEach((e) => api.addEvent(e));
  }, [events]);

  function handleEventClick(info: EventClickArg) {
    const horario = info.event.extendedProps.horario as HorarioGlobal;
    setSelectedHorario(horario);
    setDetailOpen(true);
  }

  function handleEditFromDetail() {
    setDetailOpen(false);
    setEditingHorario(selectedHorario);
    setDefaultDate(undefined);
    setDefaultTime(undefined);
    setFormOpen(true);
  }

  function handleDateClick(info: DateClickArg) {
    setEditingHorario(null);
    setDefaultDate(info.dateStr.slice(0, 10));
    const timeMatch = info.dateStr.match(/T(\d{2}:\d{2})/);
    setDefaultTime(timeMatch ? timeMatch[1] : undefined);
    setFormOpen(true);
  }

  return (
    <>
      {/* Legend */}
      {legend.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-3">
          {legend.map((l) => (
            <div key={l.nombre} className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: l.color }} />
              <span className="text-xs text-[var(--color-text-muted)]">{l.nombre}</span>
            </div>
          ))}
        </div>
      )}

      <div className="calendario-admin">
        <style>{`
          .calendario-admin .fc {
            --fc-border-color: var(--color-border);
            --fc-page-bg-color: var(--color-bg);
            --fc-neutral-bg-color: var(--color-bg-secondary);
            --fc-today-bg-color: color-mix(in srgb, var(--color-brand-gold) 8%, transparent);
            --fc-event-border-color: transparent;
            font-family: var(--font-body);
          }
          .calendario-admin .fc .fc-toolbar-title {
            font-family: var(--font-display);
            font-size: 1.25rem;
            color: var(--color-text-primary);
            text-transform: capitalize;
          }
          .calendario-admin .fc .fc-button {
            background: var(--color-bg-secondary);
            border-color: var(--color-border);
            color: var(--color-text-primary);
            font-size: 0.8rem;
            padding: 0.25rem 0.75rem;
            border-radius: var(--radius-md);
            font-weight: 500;
          }
          .calendario-admin .fc .fc-button:hover {
            background: var(--color-brand-gold-muted);
            border-color: var(--color-brand-gold);
          }
          .calendario-admin .fc .fc-button-active,
          .calendario-admin .fc .fc-button.fc-button-active {
            background: var(--color-brand-gold) !important;
            border-color: var(--color-brand-gold) !important;
            color: var(--color-brand-black) !important;
          }
          .calendario-admin .fc .fc-col-header-cell {
            padding: 0.5rem 0;
            font-weight: 600;
            text-transform: capitalize;
            color: var(--color-text-secondary);
            font-size: 0.8rem;
          }
          .calendario-admin .fc .fc-daygrid-day-number {
            color: var(--color-text-primary);
            font-size: 0.85rem;
            padding: 4px 8px;
          }
          .calendario-admin .fc .fc-event {
            border-radius: 6px;
            padding: 2px 6px;
            font-size: 0.75rem;
            cursor: pointer;
            border: none;
          }
          .calendario-admin .fc .fc-list-event:hover td {
            background: var(--color-bg-secondary);
          }
          .calendario-admin .fc .fc-scrollgrid {
            border-color: var(--color-border);
          }
          @media (max-width: 640px) {
            .calendario-admin .fc .fc-toolbar-title {
              font-size: 0.95rem;
            }
            .calendario-admin .fc .fc-button {
              font-size: 0.7rem;
              padding: 0.2rem 0.45rem;
            }
            .calendario-admin .fc .fc-toolbar.fc-header-toolbar {
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
            right: isMobile ? 'dayGridMonth,timeGridWeek,listWeek' : 'nuevaClase dayGridMonth,timeGridWeek,listWeek',
          }}
          customButtons={{
            nuevaClase: {
              text: `+ ${t('nueva_clase')}`,
              click: () => {
                setEditingHorario(null);
                setDefaultDate(undefined);
                setDefaultTime(undefined);
                setFormOpen(true);
              },
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
          dateClick={handleDateClick}
          eventDisplay="block"
          height={currentView === 'timeGridWeek' ? (isMobile ? '65vh' : '78vh') : 'auto'}
          aspectRatio={1.8}
          scrollTime="08:00:00"
          nowIndicator={true}
          weekends={true}
          datesSet={(arg) => setCurrentView(arg.view.type)}
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
            <Button onClick={handleEditFromDetail}>
              <Pencil className="mr-1.5 h-4 w-4" />
              {t('editar_horario')}
            </Button>
          </div>
        }
      >
        {selectedHorario && (
          <div className="space-y-4">
            {/* Profesor */}
            {selectedHorario.profesor && (
              <div className="flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-3">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: profesorColorMap[selectedHorario.profesor_id]?.bg || 'var(--color-text-muted)' }}
                >
                  <User className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    Prof. {selectedHorario.profesor.nombre} {selectedHorario.profesor.apellido}
                  </p>
                </div>
              </div>
            )}

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
            </div>

            {/* Horario */}
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <Clock className="h-4 w-4" />
              <span>{selectedHorario.fecha} · {selectedHorario.hora_inicio} - {selectedHorario.hora_fin}</span>
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
          </div>
        )}
      </Modal>

      {/* HorarioForm Modal */}
      <HorarioForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingHorario(null); }}
        profesorId={editingHorario?.profesor_id || ''}
        horario={editingHorario as never}
        defaultDate={defaultDate}
        defaultTime={defaultTime}
        adminProfesores={adminProfesores}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['admin-horarios'] })}
      />
    </>
  );
}
