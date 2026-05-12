'use client';

import { useCallback, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CalendarDays, CheckCircle, Clock, XCircle, Plus } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { CalendarioProfesor } from '@/components/calendario/CalendarioProfesor';
import { useUser } from '@/lib/hooks/useUser';
import { useHorarios } from '@/lib/hooks/useHorarios';

export default function ProfesorDashboardPage() {
  const t = useTranslations('dashboard.profesor');
  const th = useTranslations('horarios');
  const { user } = useUser();
  const { stats } = useHorarios(user?.id);
  const [newClassTrigger, setNewClassTrigger] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openHorarioId = searchParams.get('horario');

  const handleHorarioOpened = useCallback(() => {
    router.replace(pathname);
  }, [router, pathname]);

  if (!user) return null;

  const statCards = [
    { label: t('clases_semana'), value: stats.total, icon: CalendarDays, color: 'var(--color-text-primary)' },
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
