import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div>
        <h1
          className="text-[clamp(1.5rem,4vw,2rem)] font-bold leading-tight text-[var(--color-text-primary)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-[var(--color-text-muted)] text-sm">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="mt-3 flex gap-2 sm:mt-0">{actions}</div>}
    </div>
  );
}
