'use client';

/**
 * Renders HTML content from a rich-text description field.
 * Lightweight alternative to loading full TipTap for read-only display.
 * Used wherever class descriptions are shown.
 */

export interface RichDescriptionProps {
  html: string;
  className?: string;
}

export function RichDescription({ html, className }: RichDescriptionProps) {
  return (
    <div
      className={`prose-sm max-w-none text-sm text-[var(--color-text-secondary)] [&_p]:mb-1 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mb-0.5 [&_strong]:font-semibold [&_em]:italic ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
