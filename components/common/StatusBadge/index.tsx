import { cn } from '@/lib/utils';
import type { EstadoAsistencia } from '@/lib/supabase/types';

type StatusType = EstadoAsistencia | 'bloqueado' | 'graduado' | 'activo' | 'inactivo';

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  confirmado: {
    label: 'Confirmado',
    className: 'bg-green-50 text-[var(--color-success)] dark:bg-green-950/30',
  },
  pendiente: {
    label: 'Pendiente',
    className: 'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]',
  },
  cancelado: {
    label: 'Cancelado',
    className: 'bg-red-50 text-[var(--color-error)] dark:bg-red-950/30',
  },
  cambiado: {
    label: 'Cambio solicitado',
    className: 'bg-blue-50 text-[var(--color-info)] dark:bg-blue-950/30',
  },
  no_asistio: {
    label: 'No asistió',
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  },
  bloqueado: {
    label: 'Bloqueado',
    className: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  },
  graduado: {
    label: '🎓 Graduado',
    className:
      'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)] font-semibold shadow-[var(--shadow-gold)]',
  },
  activo: {
    label: 'Activo',
    className: 'bg-green-50 text-[var(--color-success)] dark:bg-green-950/30',
  },
  inactivo: {
    label: 'Inactivo',
    className: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
