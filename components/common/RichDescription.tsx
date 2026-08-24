'use client';

/**
 * Renders HTML content from a rich-text description field.
 * Lightweight alternative to loading full TipTap for read-only display.
 * Used wherever class descriptions are shown.
 *
 * Handles both HTML content (from TipTap editor) and legacy plain text
 * with \n line breaks (from the old textarea).
 */

export interface RichDescriptionProps {
  html: string;
  className?: string;
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

export function RichDescription({ html, className }: RichDescriptionProps) {
  return (
    <div
      className={`prose-sm max-w-none text-sm text-[var(--color-text-secondary)] [&_p]:mb-1 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mb-0.5 [&_strong]:font-semibold [&_em]:italic ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: toHtml(html) }}
    />
  );
}
