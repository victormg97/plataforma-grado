'use client';

import { GraduationCap } from 'lucide-react';

/** Compact pill marking special class types (exam / simulation). Readable on light and dark themes. */
export function ClaseTipoBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-accent-border)] bg-[var(--color-accent-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-accent-fg)]">
      <GraduationCap className="size-3" />
      {label}
    </span>
  );
}
