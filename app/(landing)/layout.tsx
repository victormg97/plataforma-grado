import type { ReactNode } from 'react';

/**
 * Layout base del landing page público.
 * Sin restricciones de acceso — accesible para cualquier visitante.
 */
export default function LandingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
