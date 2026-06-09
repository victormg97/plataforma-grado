import type { ReactNode } from 'react';
import { MotionProvider } from '@/components/common/MotionProvider';

/**
 * Layout base del landing page público.
 * Sin restricciones de acceso — accesible para cualquier visitante.
 * Provee MotionProvider para las animaciones de scroll reveal.
 */
export default function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <MotionProvider>
      <div className="min-h-screen bg-[var(--color-bg)]">{children}</div>
    </MotionProvider>
  );
}
