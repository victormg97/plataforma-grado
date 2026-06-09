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
      {/* overflow-x: clip corta el desbordamiento horizontal (p. ej. de las
          animaciones de reveal que trasladan en X) sin crear un contenedor de
          scroll, por lo que NO rompe la navbar sticky. */}
      <div className="min-h-screen bg-[var(--color-bg)] [overflow-x:clip]">{children}</div>
    </MotionProvider>
  );
}
