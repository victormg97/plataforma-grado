'use client';

import { Tooltip } from '@/components/common/Tooltip';

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tooltip?: string;
}

export function FilterChip({ active, onClick, icon, label, tooltip }: FilterChipProps) {
  const button = (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-md)] border text-sm font-medium transition-colors select-none ${
        active
          ? 'bg-[var(--color-brand-gold-muted)] border-[var(--color-brand-gold)] text-[var(--color-brand-gold)]'
          : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]'
      }`}
    >
      <span
        className={`flex size-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors ${
          active
            ? 'bg-[var(--color-brand-gold)] border-[var(--color-brand-gold)]'
            : 'border-[var(--color-border-strong)]'
        }`}
      >
        {active && (
          <svg viewBox="0 0 8 8" className="size-2.5 text-white fill-current">
            <path d="M1.5 4L3 5.5L6.5 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        )}
      </span>
      {icon}
      {label}
    </button>
  );

  if (tooltip) {
    return <Tooltip content={tooltip} position="top">{button}</Tooltip>;
  }

  return button;
}
