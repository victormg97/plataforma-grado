'use client';

import type { ReactNode } from 'react';

/**
 * Visual isolation wrapper for the "Comunidad Estratégica" mini-app.
 *
 * The namespaced CSS variables (--game-*) are defined in globals.css under
 * `.game-scope` (light) and `.dark .game-scope` (dark), so the mini-app keeps
 * its own burgundy + gold identity while automatically following the
 * platform's active theme (light/dark) driven by next-themes. This wrapper
 * only applies the `.game-scope` class; low-level primitives from
 * components/common remain reusable inside.
 */
export function GameThemeScope({ children }: { children: ReactNode }) {
  return (
    <div className="game-scope">
      <div className="rounded-[var(--game-radius)] bg-[var(--game-bg)] p-4 text-[var(--game-text)] sm:p-6">
        {children}
      </div>
    </div>
  );
}
