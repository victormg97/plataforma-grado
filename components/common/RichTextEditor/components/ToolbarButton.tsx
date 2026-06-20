'use client';

import { Tooltip } from '@/components/common/Tooltip';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ToolbarButton({
  onClick,
  active,
  disabled,
  children,
  title,
}: ToolbarButtonProps) {
  return (
    <Tooltip content={title} position="bottom" variant="subtle">
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          onClick();
        }}
        disabled={disabled}
        aria-label={title}
        className={`flex items-center justify-center h-8 w-8 rounded-[var(--radius-sm)] transition-colors
          ${active
            ? 'bg-[var(--color-brand-gold)] text-white'
            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]'
          }
          disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {children}
      </button>
    </Tooltip>
  );
}
