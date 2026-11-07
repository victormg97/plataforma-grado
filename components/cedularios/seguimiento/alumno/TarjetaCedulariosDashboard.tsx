'use client';

/**
 * Dashboard card of the student (Req 24.4, 24.5).
 *
 * Shows how many cedularios are assigned and the global progress (sum of assigned and
 * covered materias, never an average of percentages) with a link to `/alumno/programas`.
 *
 * It renders nothing while loading, on error, or when the student has no active
 * assignments, so the dashboard never shows an empty or broken card. Queries only use the
 * session user id.
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/common/Card';
import { agregadoAlumno } from '@/lib/cedularios/seguimiento/agregados';
import { calcularPorcentaje } from '@/lib/cedularios/seguimiento/porcentaje';
import { useResumenAlumno } from '../hooks/useResumenAlumno';
import { useSegRol } from '../hooks/useSegRol';
import { PorcentajeTexto } from '../compartidos/PorcentajeTexto';
import { ProgresoBarra } from '../compartidos/ProgresoBarra';

const RUTA_PROGRAMAS = '/alumno/programas';

interface TarjetaCedulariosDashboardProps {
  className?: string;
}

export function TarjetaCedulariosDashboard({ className }: TarjetaCedulariosDashboardProps) {
  const t = useTranslations('cedularios.seguimiento.alumno.tarjeta');
  const { userId } = useSegRol();

  // Only the session user id is used to query.
  const { data: resumen } = useResumenAlumno(userId);

  const activas = useMemo(
    () => (resumen ? resumen.asignaciones.filter((a) => a.estado === 'activa') : []),
    [resumen],
  );

  const porcentaje = useMemo(() => {
    const { total, cubiertas } = agregadoAlumno(activas);
    return calcularPorcentaje(cubiertas, total);
  }, [activas]);

  if (activas.length === 0) return null;

  return (
    <section aria-labelledby="tarjeta-cedularios-titulo" className={className}>
      <Link
        href={RUTA_PROGRAMAS}
        className="block rounded-[var(--radius-lg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-gold)]"
      >
        <Card hover>
          <div className="flex items-start gap-3">
            <BookOpen
              className="mt-0.5 size-5 shrink-0 text-[var(--color-brand-gold)]"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <h2
                  id="tarjeta-cedularios-titulo"
                  className="text-sm font-semibold text-[var(--color-text-primary)]"
                >
                  {t('titulo')}
                </h2>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {t('asignados', { count: activas.length })}
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs text-[var(--color-text-muted)]">
                  <span>{t('avance_global')}</span>
                  <PorcentajeTexto porcentaje={porcentaje} className="text-sm" />
                </div>
                <ProgresoBarra porcentaje={porcentaje} tamano="sm" />
              </div>

              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-brand-gold)]">
                {t('ver')}
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </span>
            </div>
          </div>
        </Card>
      </Link>
    </section>
  );
}
