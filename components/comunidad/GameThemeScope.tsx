'use client';

import type { ReactNode } from 'react';

/**
 * Visual isolation wrapper for the "Comunidad Estratégica" mini-app.
 *
 * Defines a set of namespaced CSS variables (--game-*) scoped to this
 * subtree only, so the mini-app has its own visual identity that neither
 * modifies nor is modified by the global platform styles. Low-level
 * primitives from components/common are still reusable inside.
 *
 * Palette derived from the approved mockups: soft rose background, white
 * surfaces with large radii and soft shadows, deep burgundy accent, gold
 * secondary accent.
 */
export function GameThemeScope({ children }: { children: ReactNode }) {
  return (
    <div
      className="game-scope"
      style={
        {
          // Backgrounds
          '--game-bg': '#fbeeec',
          '--game-surface': '#ffffff',
          '--game-surface-muted': '#f7e9e6',
          '--game-header-bg': '#5c0f1b',
          // Borders
          '--game-border': '#f0dcd8',
          // Text
          '--game-text': '#2b1418',
          '--game-text-muted': '#8a6b6b',
          '--game-on-accent': '#ffffff',
          // Accents
          '--game-accent': '#6e1423',
          '--game-accent-hover': '#83182b',
          '--game-accent-muted': '#f7dcd8',
          '--game-gold': '#b08541',
          '--game-flame': '#e0632a',
          // Feedback
          '--game-correct': '#1f9d55',
          '--game-incorrect': '#c0392b',
          '--game-option-selected-bg': '#fbd9dc',
          // Shape
          '--game-radius': '1rem',
          '--game-radius-sm': '0.625rem',
          '--game-shadow': '0 8px 24px -12px rgba(92, 15, 27, 0.25)',
        } as React.CSSProperties
      }
    >
      <div className="rounded-[var(--game-radius)] bg-[var(--game-bg)] p-4 text-[var(--game-text)] sm:p-6">
        {children}
      </div>
    </div>
  );
}
