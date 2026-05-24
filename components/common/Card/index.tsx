import { cn } from '@/lib/utils';
import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const paddingStyles = {
  none: '',
  sm: 'p-[var(--space-sm)]',
  md: 'p-[var(--space-md)]',
  lg: 'p-[var(--space-lg)]',
};

export function Card({
  className,
  hover = false,
  padding = 'md',
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card,var(--color-bg))] shadow-[var(--shadow-sm)]',
        paddingStyles[padding],
        hover && 'transition-shadow hover:shadow-[var(--shadow-md)] cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
