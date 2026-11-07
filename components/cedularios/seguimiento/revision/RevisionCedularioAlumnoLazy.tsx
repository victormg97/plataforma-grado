'use client';

/**
 * Lazy entry point of the Revisor for pages outside the cedularios module (student view,
 * pages that embed it). They import this file through `components/cedularios/index.ts`, so the
 * tree, the detail panel and the other Revisor code stay out of their initial bundle.
 * The host imports `RevisionCedularioAlumno` directly.
 */

import dynamic from 'next/dynamic';

/** Placeholder while the chunk loads. It has no text, so it needs no translation. */
function RevisorCargando() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="h-48 w-full animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-bg-secondary)]"
    />
  );
}

export const RevisionCedularioAlumnoLazy = dynamic(
  () => import('./RevisionCedularioAlumno').then((modulo) => modulo.RevisionCedularioAlumno),
  { ssr: false, loading: () => <RevisorCargando /> },
);

export type { RevisionCedularioAlumnoProps } from './RevisionCedularioAlumno';
