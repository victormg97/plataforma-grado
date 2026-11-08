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
  confirmado: 'bg-green-50 text-[var(--color-success-fg)] dark:bg-green-950/40',
  pendiente: 'bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)]',
  cancelado: 'bg-red-50 text-[var(--color-error-fg)] dark:bg-red-950/40',
  cambiado: 'bg-blue-50 text-[var(--color-info-fg)] dark:bg-blue-950/40',
  no_asistio: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-200',
  bloqueado: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-200',
  graduado: 'bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] font-semibold shadow-[var(--shadow-gold)]',
  activo: 'bg-green-50 text-[var(--color-success-fg)] dark:bg-green-950/40',
  inactivo: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-200',
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
