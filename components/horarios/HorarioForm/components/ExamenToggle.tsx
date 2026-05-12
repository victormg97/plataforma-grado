'use client';

import { GraduationCap } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExamenToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExamenToggle({ checked, onChange, label, description }: ExamenToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center gap-3 rounded-[var(--radius-md)] border p-3 text-left transition-colors ${
        checked
          ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)]'
          : 'border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]'
      }`}
    >
      {/* Toggle switch */}
      <div
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-[var(--color-brand-gold)]' : 'bg-[var(--color-border)]'
        }`}
      >
        <div
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${
          checked ? 'text-[var(--color-brand-gold)]' : 'text-[var(--color-text-primary)]'
        }`}>{label}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{description}</p>
      </div>
      {checked && <GraduationCap className="size-4 shrink-0 text-[var(--color-brand-gold)]" />}
    </button>
  );
}
