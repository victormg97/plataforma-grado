'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSegRol } from '../hooks/useSegRol';
import { useSegUrl } from '../url/useSegUrl';

// The implementation (reviewer, assign dialog, queries) loads only when a seg_modal exists.
const SeguimientoHostImpl = dynamic(
  () => import('./SeguimientoHostImpl').then((mod) => mod.SeguimientoHostImpl),
  { ssr: false, loading: () => null },
);

function SeguimientoHostCascara() {
  const { estado } = useSegUrl();
  const { isStaff } = useSegRol();

  // Alumno and lector never open the host, even with seg_modal in the URL.
  if (estado.modal === null || !isStaff) return null;

  return <SeguimientoHostImpl />;
}

/**
 * Minimal shell of the tracking host, mounted once in the dashboard layout.
 *
 * Renders nothing unless the URL has `seg_modal` and the user is staff (admin or
 * profesor). Suspense is required because `useSegUrl` reads `useSearchParams`.
 */
export function SeguimientoHost() {
  return (
    <Suspense fallback={null}>
      <SeguimientoHostCascara />
    </Suspense>
  );
}
