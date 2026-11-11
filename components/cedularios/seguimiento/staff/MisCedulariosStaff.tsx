'use client';
import { Suspense } from 'react';
import { SeccionCedulariosFicha } from '../ficha/SeccionCedulariosFicha';
import { useSegRol } from '../hooks/useSegRol';

/**
 * "Mis cedularios" section for profesores and administradores (Programas pages): the existing
 * record section with the user's own id and the `propio` copy. Renders nothing for other roles.
 * `useSegUrl` reads the search params, hence the Suspense boundary.
 */
export function MisCedulariosStaff() {
  const { userId, rol, isStaff } = useSegRol();
  if (!isStaff || !userId) return null;
  return (
    <Suspense fallback={null}>
      <div className="mb-[var(--space-lg)]">
        <SeccionCedulariosFicha
          alumnoId={userId}
          role={rol === 'admin' ? 'admin' : 'profesor'}
          variante="propio"
        />
      </div>
    </Suspense>
  );
}
