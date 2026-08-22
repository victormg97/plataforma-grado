'use client';

import { m } from 'framer-motion';
import type { ReactNode } from 'react';

interface RevealProps {
  children: ReactNode;
  /** Retraso de la animación en segundos */
  delay?: number;
  /** Dirección desde la que entra el contenido */
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  className?: string;
}

const offset = 32;

/**
 * Envuelve contenido para que aparezca con un fade + slide suave cuando
 * entra en el viewport (scroll reveal). Respeta prefers-reduced-motion vía
 * la configuración global de framer-motion.
 *
 * Requiere un `MotionProvider` (LazyMotion) por encima; el layout del
 * dashboard y el del landing ya lo proveen.
 */
export function Reveal({ children, delay = 0, direction = 'up', className }: RevealProps) {
  const initial: { opacity: number; x?: number; y?: number } = { opacity: 0 };
  if (direction === 'up') initial.y = offset;
  if (direction === 'down') initial.y = -offset;
  if (direction === 'left') initial.x = offset;
  if (direction === 'right') initial.x = -offset;

  return (
    <m.div
      className={className}
      initial={initial}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </m.div>
  );
}
