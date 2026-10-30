import { cn } from '@/lib/utils';

/**
 * Renders question-bank HTML with the game's own typography.
 *
 * Content is often pasted from Word / Google Docs and carries inline
 * presentation (background highlights, colors, fonts, sizes). The `.game-rich`
 * styles in globals.css neutralize that so every question looks the same in
 * every theme, while keeping the author's emphasis: bold, italic, underline,
 * strikethrough, lists and links.
 *
 *  - question: the problem statement (larger, semibold, reads as a title).
 *  - body:     explanations and longer text.
 */
export function GameRichText({
  html,
  variant = 'body',
  className,
}: {
  html: string;
  variant?: 'question' | 'body';
  className?: string;
}) {
  return (
    <div
      className={cn('game-rich', variant === 'question' ? 'game-rich-question' : 'game-rich-body', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
