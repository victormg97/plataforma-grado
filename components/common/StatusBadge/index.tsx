'use client';

import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import type { EstadoAsistencia } from '@/lib/supabase/types';

type StatusType = EstadoAsistencia | 'bloqueado' | 'graduado' | 'activo' | 'inactivo' | 'en_curso';

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusClassName: Record<StatusType, string> = {
  confirmado: 'bg-green-50 text-[var(--color-success)] dark:bg-green-950/30',
  pendiente: 'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]',
  cancelado: 'bg-red-50 text-[var(--color-error)] dark:bg-red-950/30',
  cambiado: 'bg-blue-50 text-[var(--color-info)] dark:bg-blue-950/30',
  no_asistio: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  bloqueado: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  graduado: 'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)] font-semibold shadow-[var(--shadow-gold)]',
  activo: 'bg-green-50 text-[var(--color-success)] dark:bg-green-950/30',
  inactivo: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  en_curso: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 animate-pulse',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const t = useTranslations('asistencia.estados');

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        statusClassName[status],
        className
      )}
    >
      {t(status)}
    </span>
  );
}
