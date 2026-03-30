import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'gold' | 'success' | 'error' | 'info';
  className?: string;
}

const variantStyles = {
  default: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]',
  gold: 'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]',
  success: 'bg-green-50 text-[var(--color-success)] dark:bg-green-950/30',
  error: 'bg-red-50 text-[var(--color-error)] dark:bg-red-950/30',
  info: 'bg-blue-50 text-[var(--color-info)] dark:bg-blue-950/30',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
