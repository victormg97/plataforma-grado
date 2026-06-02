'use client';

import { useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { Users, GraduationCap, CalendarDays, Clock, Bell, CheckCircle, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { Collapsible } from '@/components/common/Collapsible';
import { RotatingStatCard, type RotatingStatItem } from '@/components/common/RotatingStatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { CalendarioAdmin } from '@/components/calendario/CalendarioAdmin';
import { useUserStore } from '@/stores/useUserStore';
import { useUIStore } from '@/stores/useUIStore';
import { useUiPreference } from '@/lib/hooks/useUiPreference';
import { buildClaseDetailHref } from '@/lib/utils/horarioNavigation';
import { useTranslations, useLocale } from 'next-intl';

type Stats = {
  total_alumnos: number;
  total_profesores: number;
  clases_hoy: number;
  clases_semana: number;
  clases_mes: number;
  pendientes: number;
  estado_pendientes: number;
  estado_confirmadas: number;
  estado_canceladas: number;
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
  const { setHorarioDetailId } = useUIStore();
  const t = useTranslations('dashboard.admin');
  const locale = useLocale();
  const dateFnsLocale = locale === 'en' ? enUS : es;
  const router = useRouter();
  const queryClient = useQueryClient();

  const invalidateNotif = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin-notificaciones-dash'] });
    queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
    queryClient.invalidateQueries({ queryKey: ['notificaciones-full'] });
  }, [queryClient]);

  const { data: stats } = useQuery<Stats>({
    queryKey: ['admin-stats'],
    queryFn: async () => { const r = await fetch('/api/admin/stats'); return r.json(); },
    staleTime: 60_000,
  });

  const { data: notificaciones = [] } = useQuery<Notificacion[]>({
    queryKey: ['admin-notificaciones-dash'],
    queryFn: async () => {
      const r = await fetch('/api/notificaciones?page_size=10');
      const d = await r.json();
      return Array.isArray(d) ? d : (d.data ?? []);
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
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  // Plain stat cards (counts that don't rotate)
  const statCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: t('alumnos'), value: stats.total_alumnos, icon: Users, color: 'var(--color-text-primary)' },
      { label: t('profesores'), value: stats.total_profesores, icon: GraduationCap, color: 'var(--color-brand-gold)' },
    ];
  }, [stats, t]);

  // Rotating "Clases" card — cycles between today / week / month
  const clasesItems = useMemo<RotatingStatItem[]>(() => {
    if (!stats) return [];
    return [
      { key: 'hoy', value: stats.clases_hoy ?? 0, label: t('clases_hoy') },
      { key: 'semana', value: stats.clases_semana ?? 0, label: t('clases_semana') },
      { key: 'mes', value: stats.clases_mes ?? 0, label: t('clases_mes') },
    ];
  }, [stats, t]);

  // Rotating "Estados" card — cycles between pending / confirmed / cancelled.
  // Each state carries its own icon + color so the bubble matches the value.
  const estadoItems = useMemo<RotatingStatItem[]>(() => {
    if (!stats) return [];
    return [
      { key: 'pendientes', value: stats.estado_pendientes ?? 0, label: t('pendientes'), icon: <Clock className="size-5" />, color: 'var(--color-brand-gold)' },
      { key: 'confirmadas', value: stats.estado_confirmadas ?? 0, label: t('confirmadas'), icon: <CheckCircle className="size-5" />, color: 'var(--color-success)' },
      { key: 'canceladas', value: stats.estado_canceladas ?? 0, label: t('canceladas'), icon: <XCircle className="size-5" />, color: 'var(--color-error)' },
    ];
  }, [stats, t]);

  // Sort classes by hora_inicio for consistent display
  const clasesHoySorted = useMemo(
    () => [...clasesHoy].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio)),
    [clasesHoy]
  );

  // Per-user accordion state (default open; persisted to profiles.ui_preferences, debounced)
  const [actividadOpen, setActividadOpen] = useUiPreference<boolean>('admin_dash_actividad_open', true);
  const [clasesHoyOpen, setClasesHoyOpen] = useUiPreference<boolean>('admin_dash_clases_hoy_open', true);

  // Handle click on an activity-feed notification:
  // 1. Mark as read (fire-and-forget)
  // 2. Navigate to the relevant detail depending on notification type
  const handleNotifClick = useCallback(async (n: Notificacion) => {
    // Mark as read if not already
    if (!n.leida) {
      await fetch('/api/notificaciones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [n.id] }),
      });
      invalidateNotif();
    }

    // Navigate based on type
    if (n.horario_id) {
      // Class-related notifications → open class detail drawer
      setHorarioDetailId(n.horario_id);
      return;
    }

    if (n.tipo === 'programa_asignado' && n.alumno_id) {
      // Program assignment → go to the alumno's profile/programs
      router.push(`/admin/alumnos/${n.alumno_id}`);
      return;
    }

    if (n.tipo === 'solicitud_cambio_horario' || n.tipo === 'cambio_horario_aceptado' || n.tipo === 'cambio_horario_rechazado') {
      // Schedule change requests → go to notifications full view for detail
      router.push('/admin/notificaciones');
      return;
    }

    // Fallback: go to notifications page
    router.push('/admin/notificaciones');
  }, [invalidateNotif, setHorarioDetailId, router]);

  return (
    <div>
      <PageHeader
        title={t('titulo')}
        subtitle={user ? t('bienvenido', { nombre: user.nombre }) : t('subtitulo')}
      />

      {/* Estadísticas globales */}
      <div className="mt-[var(--space-lg)] grid grid-cols-2 gap-[var(--space-md)] md:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label} padding="md">
            <div className="flex items-center gap-3">
              <div
                className="flex size-10 items-center justify-center rounded-full"
                style={{ backgroundColor: `color-mix(in srgb, ${stat.color} 12%, transparent)` }}
              >
                <stat.icon className="size-5" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--color-text-primary)]">{stat.value}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{stat.label}</p>
              </div>
            </div>
          </Card>
        ))}

        {/* Rotating: Clases (hoy / semana / mes) */}
        <RotatingStatCard
          items={clasesItems}
          icon={<CalendarDays className="size-5" />}
          color="var(--color-success)"
          ariaLabel={t('clases_hoy')}
          showIndicators={false}
        />

        {/* Rotating: Estados de clases (pendientes / confirmadas / canceladas) */}
        <RotatingStatCard
          items={estadoItems}
          onlyWithData={false}
          ariaLabel={t('pendientes')}
          showIndicators={false}
        />
      </div>


      {/* Two-column: Actividad reciente + Clases hoy (accordions, state saved per user) */}
      <div className="mt-[var(--space-md)] grid grid-cols-1 gap-[var(--space-md)] lg:grid-cols-2">
        {/* Actividad reciente */}
        <Collapsible
          open={actividadOpen}
          onOpenChange={setActividadOpen}
          icon={<Bell className="size-3.5" />}
          title={t('actividad_reciente')}
          contentClassName="p-0"
          className="shadow-[var(--shadow-sm)] self-start"
        >
          {notificaciones.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">{t('sin_actividad')}</p>
          ) : (
            <div className="divide-y divide-[var(--color-border)] max-h-64 overflow-y-auto">
              {notificaciones.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleNotifClick(n)}
                  className={`group flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-[var(--color-bg-secondary)] ${!n.leida ? 'bg-[var(--color-brand-gold-muted)]' : ''}`}
                >
                  <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${!n.leida ? 'bg-[var(--color-brand-gold)]' : 'bg-[var(--color-border-strong)]'}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm leading-snug ${!n.leida ? 'font-medium text-[var(--color-text-primary)]' : 'text-[var(--color-text-primary)]'}`}>{n.mensaje}</p>
                    {n.destinatario && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                        → {n.destinatario.nombre} {n.destinatario.apellido}
                        <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                          n.destinatario.rol === 'profesor'
                            ? 'bg-[color-mix(in_srgb,var(--color-brand-gold)_15%,transparent)] text-[var(--color-brand-gold)]'
                            : 'bg-[color-mix(in_srgb,var(--color-info)_15%,transparent)] text-[var(--color-info)]'
                        }`}>
                          {n.destinatario.rol === 'profesor' ? t('rol_profesor') : t('rol_alumno')}
                        </span>
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {n.horario && (
                        <>
                          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[10px] text-[var(--color-text-muted)]">
                            <CalendarDays className="size-2.5" />
                            {format(new Date(n.horario.fecha + 'T12:00:00'), "d 'de' MMM", { locale: dateFnsLocale })}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[10px] text-[var(--color-text-muted)]">
                            <Clock className="h-2.5 w-2.5" />
                            {n.horario.hora_inicio.slice(0, 5)} – {n.horario.hora_fin.slice(0, 5)}
                          </span>
                        </>
                      )}
                      <span className="text-[10px] text-[var(--color-text-muted)]">
                        {format(new Date(n.created_at), "d 'de' MMM, HH:mm", { locale: dateFnsLocale })}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Collapsible>

        {/* Clases hoy */}
        <Collapsible
          open={clasesHoyOpen}
          onOpenChange={setClasesHoyOpen}
          icon={<CalendarDays className="size-3.5" />}
          title={t('clases_hoy')}
          contentClassName="p-0"
          className="shadow-[var(--shadow-sm)] self-start"
        >
          {clasesHoySorted.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">{t('sin_clases_hoy')}</p>
          ) : (
            <div className="divide-y divide-[var(--color-border)] max-h-64 overflow-y-auto">
              {clasesHoySorted.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => router.push(buildClaseDetailHref(c.id, 'admin', '/admin'))}
                  className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--color-bg-secondary)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{c.titulo}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[10px] text-[var(--color-text-muted)]">
                        <Clock className="size-2.5" />
                        {c.hora_inicio.slice(0, 5)} – {c.hora_fin.slice(0, 5)}
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
                </button>
              ))}
            </div>
          )}
        </Collapsible>
      </div>

      {/* Calendario Global */}
      <div className="mt-[var(--space-lg)]">
        <CalendarioAdmin />
      </div>
    </div>
  );
}
