'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useTranslations, useLocale } from 'next-intl';
import { format, subMonths } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { AlumnoPago } from '@/components/pagos/TrackingTab';
import type { AlumnoResumenAnual } from '@/app/api/admin/pagos/resumen/route';

function formatCLP(amount: number): string {
  return `$${amount.toLocaleString('es-CL')}`;
}

interface StatsTabProps {
  año: number;
  mes: number;
}

export function StatsTab({ año, mes }: StatsTabProps) {
  const t = useTranslations('pagos');
  const locale = useLocale();
  const dateLocale = locale === 'en' ? enUS : es;

  // Reuse the tracking data already in cache
  const { data: alumnos = [] } = useQuery<AlumnoPago[]>({
    queryKey: ['admin-pagos', año, mes],
    queryFn: async () => {
      const r = await fetch(`/api/admin/pagos?año=${año}&mes=${mes}`);
      return r.json();
    },
    staleTime: 30_000,
  });

  // Annual data for trend chart
  const { data: resumenAnual = [] } = useQuery<AlumnoResumenAnual[]>({
    queryKey: ['admin-pagos-anual', año],
    queryFn: async () => {
      const r = await fetch(`/api/admin/pagos/resumen?año=${año}`);
      return r.json();
    },
    staleTime: 60_000,
  });

  // Current month stats (active students only)
  const stats = useMemo(() => {
    const active = alumnos.filter((a) => a.activo);
    const total = active.length;
    const pagados = active.filter((a) => a.pago?.estado === 'pagado').length;
    const parciales = active.filter((a) => a.pago?.estado === 'parcial').length;
    const pendientes = total - pagados - parciales;
    const tasaPago = total > 0 ? Math.round(((pagados + parciales) / total) * 100) : 0;
    const totalParciales = active.reduce((acc, a) => {
      if (a.pago?.estado === 'parcial' && a.pago.monto_pagado) return acc + a.pago.monto_pagado;
      return acc;
    }, 0);
    return { total, pagados, parciales, pendientes, tasaPago, totalParciales };
  }, [alumnos]);

  // Monthly trend: build last 6 months from annual data
  const trendData = useMemo(() => {
    const months: { label: string; pagados: number; parciales: number; pendientes: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(año, mes - 1, 1), i);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      const label = format(d, 'MMM', { locale: dateLocale });

      let pagados = 0;
      let parciales = 0;
      let total = 0;

      // For current year, use resumenAnual; for previous year months, we'd need a separate query
      // For simplicity, only show data from the current year's resumen
      if (y === año) {
        for (const alumno of resumenAnual) {
          if (!alumno.activo) continue;
          total++;
          const pago = alumno.pagos.find((p) => p.mes === m);
          if (pago?.estado === 'pagado') pagados++;
          else if (pago?.estado === 'parcial') parciales++;
        }
      }
      months.push({ label, pagados, parciales, pendientes: total - pagados - parciales });
    }
    return months;
  }, [resumenAnual, año, mes, dateLocale]);

  // Pie chart data
  const pieData = useMemo(() => [
    { name: t('estado_pagado'), value: stats.pagados, color: 'var(--color-success)' },
    { name: t('estado_parcial'), value: stats.parciales, color: 'var(--color-partial)' },
    { name: t('estado_pendiente'), value: stats.pendientes, color: 'var(--color-text-muted)' },
  ].filter((d) => d.value > 0), [stats, t]);

  const hasTrendData = trendData.some((d) => d.pagados + d.parciales + d.pendientes > 0);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label={t('stats_tasa_pago')}
          value={`${stats.tasaPago}%`}
          sub={`${stats.pagados + stats.parciales} / ${stats.total}`}
          accent
        />
        <StatCard
          label={t('resumen_pagados')}
          value={String(stats.pagados)}
          sub={t('estado_pagado')}
          color="success"
        />
        <StatCard
          label={t('resumen_parcial')}
          value={String(stats.parciales)}
          sub={stats.totalParciales > 0 ? formatCLP(stats.totalParciales) : '—'}
          color="partial"
        />
        <StatCard
          label={t('resumen_pendientes')}
          value={String(stats.pendientes)}
          sub={t('estado_pendiente')}
          color="muted"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Trend bar chart — 5 cols on large screens */}
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 lg:col-span-3">
          <p className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
            {t('stats_tendencia')}
          </p>
          {!hasTrendData ? (
            <div className="flex h-40 items-center justify-center text-sm text-[var(--color-text-muted)]">
              {t('stats_sin_datos')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={trendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <RechartTooltip
                  contentStyle={{
                    background: 'var(--color-bg-elevated)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="pagados" stackId="a" fill="var(--color-success)" radius={[0, 0, 0, 0]} name={t('estado_pagado')} />
                <Bar dataKey="parciales" stackId="a" fill="var(--color-partial)" radius={[0, 0, 0, 0]} name={t('estado_parcial')} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Donut chart — 2 cols */}
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 lg:col-span-2">
          <p className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
            {t('stats_distribucion')}
          </p>
          {pieData.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-[var(--color-text-muted)]">
              {t('stats_sin_datos')}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartTooltip
                    contentStyle={{
                      background: 'var(--color-bg-elevated)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="flex flex-col gap-1.5 w-full">
                {pieData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="size-2.5 rounded-full" style={{ background: d.color }} />
                      <span className="text-[var(--color-text-secondary)]">{d.name}</span>
                    </div>
                    <span className="font-medium text-[var(--color-text-primary)]">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  color?: 'success' | 'partial' | 'muted';
  accent?: boolean;
}) {
  const valueColor = accent
    ? 'text-[var(--color-brand-gold)]'
    : color === 'success'
    ? 'text-[var(--color-success)]'
    : color === 'partial'
    ? 'text-[var(--color-partial)]'
    : 'text-[var(--color-text-primary)]';

  return (
    <div
      className={cn(
        'rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3',
        accent && 'border-[var(--color-brand-gold-muted)] bg-[var(--color-brand-gold-muted)]'
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className={cn('mt-1 text-2xl font-bold leading-none', valueColor)}>{value}</p>
      <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{sub}</p>
    </div>
  );
}
