'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CalendarDays, CheckCircle, Clock, XCircle, Plus } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { RotatingStatCard, type RotatingStatItem } from '@/components/common/RotatingStatCard';
import { CalendarioProfesor } from '@/components/calendario/CalendarioProfesor';
import { useUser } from '@/lib/hooks/useUser';
import { useHorarios } from '@/lib/hooks/useHorarios';

export default function ProfesorDashboardPage() {
  const t = useTranslations('dashboard.profesor');
  const th = useTranslations('horarios');
  const { user } = useUser();
  const { stats, horarios } = useHorarios(user?.id);
  const [newClassTrigger, setNewClassTrigger] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openHorarioId = searchParams.get('horario');

  const handleHorarioOpened = useCallback(() => {
    router.replace(pathname);
  }, [router, pathname]);

  // Rotating "Clases" card — today / week / month counts from active horarios
  const clasesItems = useMemo<RotatingStatItem[]>(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const dow = (today.getDay() + 6) % 7; // Monday = 0
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dow);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const y = today.getFullYear();
    const mo = today.getMonth();

    let hoy = 0;
    let semana = 0;
    let mes = 0;
    for (const h of horarios) {
      if (h.fecha === todayStr) hoy++;
      const d = new Date(h.fecha + 'T12:00:00');
      if (d >= weekStart && d <= weekEnd) semana++;
      if (d.getFullYear() === y && d.getMonth() === mo) mes++;
    }

    return [
      { key: 'hoy', value: hoy, label: t('clases_hoy') },
      { key: 'semana', value: semana, label: t('clases_semana') },
      { key: 'mes', value: mes, label: t('clases_mes') },
    ];
  }, [horarios, t]);

  if (!user) return null;

  const stateCards = [
    { label: t('pendientes'), value: stats.pendientes, icon: Clock, color: 'var(--color-brand-gold)' },
    { label: t('confirmadas'), value: stats.confirmadas, icon: CheckCircle, color: 'var(--color-success)' },
    { label: t('canceladas'), value: stats.canceladas, icon: XCircle, color: 'var(--color-error)' },
  ];

  return (
    <div>
      <PageHeader
        title={t('titulo')}
        subtitle={t('subtitulo')}
        actions={
          <Button onClick={() => setNewClassTrigger((n) => n + 1)}>
            <Plus className="mr-1.5 size-4" />
            {th('nueva_clase')}
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="mt-[var(--space-lg)] grid grid-cols-2 gap-[var(--space-md)] md:grid-cols-4">
        {/* Rotating: Clases (hoy / semana / mes) */}
        <RotatingStatCard
          items={clasesItems}
          icon={<CalendarDays className="size-5" />}
          color="var(--color-text-primary)"
          ariaLabel={t('clases_semana')}
        />

        {stateCards.map((stat) => (
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
      </div>

      {/* Calendar — single source of truth for horarios data */}
      <div className="mt-[var(--space-lg)]">
        <CalendarioProfesor
          profesorId={user.id}
          openNewClassTrigger={newClassTrigger}
          openHorarioId={openHorarioId}
          onHorarioOpened={handleHorarioOpened}
        />
      </div>
    </div>
  );
}
