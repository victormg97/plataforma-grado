'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Users, GraduationCap, CalendarDays, Clock, Bell } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { StatusBadge } from '@/components/common/StatusBadge';
import { CalendarioAdmin } from '@/components/calendario/CalendarioAdmin';
import { useUserStore } from '@/stores/useUserStore';

type Stats = {
  total_alumnos: number;
  total_profesores: number;
  clases_hoy: number;
  pendientes: number;
};

type Notificacion = {
  id: string;
  tipo: string;
  mensaje: string;
  leida: boolean;
  created_at: string;
  horario_id: string | null;
  horario: { id: string; fecha: string; hora_inicio: string; hora_fin: string } | null;
  alumno_id: string | null;
  alumno: { id: string; nombre: string; apellido: string } | null;
  destinatario: { id: string; nombre: string; apellido: string; rol: string } | null;
};

type ClaseHoy = {
  id: string;
  titulo: string;
  hora_inicio: string;
  hora_fin: string;
  alumno: { nombre: string; apellido: string } | null;
  profesor: { nombre: string; apellido: string } | null;
  asistencia: { estado: string }[];
};

export default function AdminDashboardPage() {
  const { user } = useUserStore();

  const { data: stats } = useQuery<Stats>({
    queryKey: ['admin-stats'],
    queryFn: async () => { const r = await fetch('/api/admin/stats'); return r.json(); },
    staleTime: 60_000,
  });

  const { data: notificaciones = [] } = useQuery<Notificacion[]>({
    queryKey: ['admin-notificaciones-dash'],
    queryFn: async () => {
      const r = await fetch('/api/notificaciones?limit=10');
      const d = await r.json();
      return Array.isArray(d) ? d : [];
    },
    staleTime: 30_000,
  });

  const { data: clasesHoy = [] } = useQuery<ClaseHoy[]>({
    queryKey: ['admin-clases-hoy'],
    queryFn: async () => {
      const r = await fetch('/api/horarios?fecha=' + new Date().toISOString().split('T')[0]);
      const d = await r.json();
      return Array.isArray(d) ? d : [];
    },
    staleTime: 60_000,
  });

  const statCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Alumnos', value: stats.total_alumnos, icon: Users, color: 'var(--color-text-primary)' },
      { label: 'Profesores', value: stats.total_profesores, icon: GraduationCap, color: 'var(--color-brand-gold)' },
      { label: 'Clases hoy', value: stats.clases_hoy, icon: CalendarDays, color: 'var(--color-success)' },
      { label: 'Pendientes', value: stats.pendientes, icon: Clock, color: 'var(--color-error)' },
    ];
  }, [stats]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={user ? `Bienvenido, ${user.nombre}` : 'Vista general de CTA Graduados'}
      />

      {/* Estadísticas globales */}
      <div className="mt-[var(--space-lg)] grid grid-cols-2 gap-[var(--space-md)] md:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label} padding="md">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: `color-mix(in srgb, ${stat.color} 12%, transparent)` }}
              >
                <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--color-text-primary)]">{stat.value}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{stat.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Two-column: Actividad reciente + Clases hoy */}
      <div className="mt-[var(--space-lg)] grid gap-[var(--space-md)] lg:grid-cols-2">
        {/* Actividad reciente */}
        <Card padding="lg">
          <h2 className="text-sm font-semibold uppercase text-[var(--color-text-muted)] mb-3 flex items-center gap-2">
            <Bell className="h-4 w-4" /> Actividad reciente
          </h2>
          {notificaciones.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">Sin actividad reciente</p>
          ) : (
            <div className="divide-y divide-[var(--color-border)] max-h-72 overflow-y-auto">
              {notificaciones.map((n) => (
                <div key={n.id} className={`flex items-start gap-3 p-3 ${!n.leida ? 'bg-[var(--color-brand-gold-muted)]' : ''}`}>
                  <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${!n.leida ? 'bg-[var(--color-brand-gold)]' : 'bg-[var(--color-border-strong)]'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--color-text-primary)] leading-snug">{n.mensaje}</p>
                    {n.destinatario && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                        → {n.destinatario.nombre} {n.destinatario.apellido}
                        <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                          n.destinatario.rol === 'profesor'
                            ? 'bg-[color-mix(in_srgb,var(--color-brand-gold)_15%,transparent)] text-[var(--color-brand-gold)]'
                            : 'bg-[color-mix(in_srgb,var(--color-info)_15%,transparent)] text-[var(--color-info)]'
                        }`}>
                          {n.destinatario.rol}
                        </span>
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {n.horario && (
                        <>
                          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[10px] text-[var(--color-text-muted)]">
                            <CalendarDays className="h-2.5 w-2.5" />
                            {format(new Date(n.horario.fecha + 'T12:00:00'), "d 'de' MMM", { locale: es })}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[10px] text-[var(--color-text-muted)]">
                            <Clock className="h-2.5 w-2.5" />
                            {n.horario.hora_inicio.slice(0, 5)} – {n.horario.hora_fin.slice(0, 5)}
                          </span>
                        </>
                      )}
                      <span className="text-[10px] text-[var(--color-text-muted)]">
                        {format(new Date(n.created_at), "d 'de' MMM, HH:mm", { locale: es })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Clases hoy */}
        <Card padding="lg">
          <h2 className="text-sm font-semibold uppercase text-[var(--color-text-muted)] mb-3 flex items-center gap-2">
            <CalendarDays className="h-4 w-4" /> Clases hoy
          </h2>
          {clasesHoy.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">No hay clases programadas para hoy</p>
          ) : (
            <div className="divide-y divide-[var(--color-border)] max-h-72 overflow-y-auto">
              {clasesHoy.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{c.titulo}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[10px] text-[var(--color-text-muted)]">
                        <Clock className="h-2.5 w-2.5" />
                        {c.hora_inicio} – {c.hora_fin}
                      </span>
                      {c.alumno && (
                        <span className="text-xs text-[var(--color-text-muted)] truncate">
                          {c.alumno.nombre} {c.alumno.apellido}
                        </span>
                      )}
                    </div>
                    {c.profesor && (
                      <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                        Prof. {c.profesor.nombre} {c.profesor.apellido}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={(c.asistencia?.[0]?.estado as 'pendiente') || 'pendiente'} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Calendario Global */}
      <div className="mt-[var(--space-lg)]">
        <CalendarioAdmin />
      </div>
    </div>
  );
}
