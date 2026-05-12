'use client';

import { StickyNote } from 'lucide-react';

type NotasIndicatorProps = {
  count: number;
};

export function NotasIndicator({ count }: NotasIndicatorProps) {
  if (count <= 0) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-brand-gold-muted)] px-2 py-0.5 text-xs font-medium text-[var(--color-brand-gold)]">
      <StickyNote className="size-3" />
      {count}
    </span>
  );
}
