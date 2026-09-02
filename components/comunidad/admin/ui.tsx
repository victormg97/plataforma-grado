'use client';

import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Card } from '@/components/common/Card';

/**
 * Shared building blocks for the Comunidad Estratégica admin config tabs.
 * They standardize the layout language introduced in the Daily Question tab:
 * an intro callout, titled sections with an icon + description, and labelled
 * form fields with hints. All colors come from CSS variables.
 */

const inputClass =
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-gold)] focus:outline-none';

/** Explanatory banner shown at the top of a config tab. */
export function ConfigCallout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card padding="lg" className="flex gap-3 bg-[var(--color-brand-gold-muted)]">
      <Info className="mt-0.5 size-5 shrink-0 text-[var(--color-brand-gold)]" />
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
        <p className="text-sm text-[var(--color-text-secondary)]">{children}</p>
      </div>
    </Card>
  );
}

/** A titled section inside its own Card (icon + title + optional description). */
export function ConfigSection({
  icon,
  title,
  description,
  actions,
  children,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Right-aligned header content (e.g. a small toggle or button). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card padding="lg" className={`flex flex-col gap-4 ${className ?? ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          {icon && <span className="mt-0.5 text-[var(--color-brand-gold)]">{icon}</span>}
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
            {description && (
              <p className="text-sm text-[var(--color-text-muted)]">{description}</p>
            )}
          </div>
        </div>
        {actions}
      </div>
      {children}
    </Card>
  );
}

/** Label + text input + optional hint. */
export function TextField({
  label,
  value,
  onChange,
  hint,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ''}`}>
      <span className="text-sm font-medium text-[var(--color-text-primary)]">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
      {hint && <span className="text-xs text-[var(--color-text-muted)]">{hint}</span>}
    </label>
  );
}

/**
 * Header row for a "list of items" tab (challenges, badges, weekly cases):
 * icon + title + count on the left, a create action on the right.
 */
export function ConfigListHeader({
  icon,
  title,
  description,
  count,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        {icon && <span className="mt-0.5 text-[var(--color-brand-gold)]">{icon}</span>}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
            {typeof count === 'number' && (
              <span className="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-muted)]">
                {count}
              </span>
            )}
          </div>
          {description && (
            <p className="text-sm text-[var(--color-text-muted)]">{description}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

/** Empty-state block for list tabs: icon + message + optional CTA. */
export function ConfigEmptyState({
  icon,
  message,
  action,
}: {
  icon?: ReactNode;
  message: string;
  action?: ReactNode;
}) {
  return (
    <Card padding="lg" className="flex flex-col items-center gap-3 py-10 text-center">
      {icon && <span className="text-[var(--color-text-muted)]">{icon}</span>}
      <p className="text-sm text-[var(--color-text-muted)]">{message}</p>
      {action}
    </Card>
  );
}

/** Label + number input + optional hint. */
export function NumberField({
  label,
  value,
  onChange,
  hint,
  min,
  max,
  step,
  className,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ''}`}>
      <span className="text-sm font-medium text-[var(--color-text-primary)]">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className={inputClass}
      />
      {hint && <span className="text-xs text-[var(--color-text-muted)]">{hint}</span>}
    </label>
  );
}
