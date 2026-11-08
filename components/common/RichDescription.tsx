'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { sanitizeHtml } from '@/lib/utils/sanitizeHtml';

/**
 * Renders HTML content from a rich-text description field.
 * Lightweight alternative to loading full TipTap for read-only display.
 * Used wherever class descriptions are shown. The HTML is sanitized (allow-list).
 *
 * Handles both HTML content (from TipTap editor) and legacy plain text
 * with \n line breaks (from the old textarea).
 */

export interface RichDescriptionProps {
  html: string;
  className?: string;
  /** `prose` = roomier typography for detail modals. */
  variant?: 'default' | 'prose';
}

/** Detect if content is already HTML (contains tags) or is plain text with newlines */
function toHtml(content: string): string {
  if (/<[a-z][\s\S]*>/i.test(content)) {
    return content;
  }
  // Legacy plain text: convert newlines to <br> or paragraph breaks
  return content
    .split('\n')
    .map((line) => `<p>${line || '<br>'}</p>`)
    .join('');
}

const BASE_CLASSES =
  'prose-sm max-w-none text-sm text-[var(--color-text-secondary)] [&_p]:mb-1 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mb-0.5 [&_strong]:font-semibold [&_em]:italic';

const PROSE_CLASSES =
  'max-w-none break-words text-sm leading-relaxed text-[var(--color-text-secondary)] ' +
  '[&_p]:mb-3 [&_p:last-child]:mb-0 ' +
  '[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ul_ul]:mt-1.5 [&_ul_ul]:mb-0 ' +
  '[&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 ' +
  '[&_li]:pl-1 [&_li::marker]:text-[var(--color-brand-gold)] [&_li>p]:mb-0 ' +
  '[&_strong]:font-semibold [&_strong]:text-[var(--color-text-primary)] [&_em]:italic ' +
  '[&_h1]:mb-2 [&_h2]:mb-2 [&_h3]:mb-2 [&_h4]:mb-2 [&_h1]:text-base [&_h2]:text-base [&_h3]:text-sm [&_h4]:text-sm ' +
  '[&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_h4]:font-semibold [&_h1]:text-[var(--color-text-primary)] [&_h2]:text-[var(--color-text-primary)] [&_h3]:text-[var(--color-text-primary)] [&_h4]:text-[var(--color-text-primary)] ' +
  '[&_blockquote]:border-l-2 [&_blockquote]:border-[var(--color-brand-gold)] [&_blockquote]:pl-3 [&_blockquote]:italic ' +
  '[&_a]:text-[var(--color-brand-gold)] [&_a]:underline [&_a]:underline-offset-2 ' +
  '[&_code]:rounded [&_code]:bg-[var(--color-bg-secondary)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs';

export function RichDescription({ html, className, variant = 'default' }: RichDescriptionProps) {
  const safeHtml = useMemo(() => sanitizeHtml(toHtml(html)), [html]);
  return (
    <div
      className={cn(variant === 'prose' ? PROSE_CLASSES : BASE_CLASSES, className)}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
