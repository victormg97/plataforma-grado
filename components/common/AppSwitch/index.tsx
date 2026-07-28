'use client';

import { cn } from '@/lib/utils';

interface AppSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  /** Size variant */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Reusable toggle switch component following the platform design system.
 * Uses CSS variables for theming. Accessible via role="switch" + aria-checked.
 */
export function AppSwitch({
  checked,
  onChange,
  disabled = false,
  label,
  description,
  size = 'md',
  className,
}: AppSwitchProps) {
  const trackSize = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11';
  const thumbSize = size === 'sm' ? 'size-3.5' : 'size-4.5';
  const thumbTranslate = size === 'sm'
    ? (checked ? 'translate-x-[18px]' : 'translate-x-[3px]')
    : (checked ? 'translate-x-[22px]' : 'translate-x-[3px]');

  const switchElement = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)] focus-visible:ring-offset-2',
        trackSize,
        checked
          ? 'bg-[var(--color-brand-gold)]'
          : 'bg-[var(--color-border-strong,#d1d5db)]',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span
        className={cn(
          'inline-block rounded-full bg-white shadow-sm transition-transform duration-200',
          thumbSize,
          thumbTranslate,
        )}
      />
    </button>
  );

  if (!label && !description) {
    return <div className={className}>{switchElement}</div>;
  }

  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0 flex-1">
        {label && (
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{label}</p>
        )}
        {description && (
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{description}</p>
        )}
      </div>
      {switchElement}
    </div>
  );
}
