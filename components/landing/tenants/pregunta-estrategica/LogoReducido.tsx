'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

interface LogoReducidoProps {
  className?: string;
}

/**
 * Logo reducido de "Pregunta Estratégica": dos círculos concéntricos con una
 * balanza de la justicia y la letra "P" al centro. Dibujado con primitivas SVG
 * (no el path original, demasiado pesado) y theme-aware como AppLogo.
 */
export function LogoReducido({ className }: LogoReducidoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  const isDark = mounted && (resolvedTheme === 'dark' || resolvedTheme === 'graduado');

  // ring = círculos exteriores; figure = balanza + P
  const ring = isDark ? '#F5E8EC' : '#2D1A1A';
  const figure = isDark ? '#E8C4CE' : '#C9C9C9';
  const letter = isDark ? '#F5E8EC' : '#2D1A1A';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      role="img"
      aria-label="Pregunta Estratégica"
      className={className}
      fill="none"
    >
      {/* Círculos concéntricos */}
      <circle cx="100" cy="100" r="96" stroke={ring} strokeWidth="3" />
      <circle cx="100" cy="100" r="86" stroke={ring} strokeWidth="2" />

      {/* Letra P al centro (detrás de la balanza) */}
      <text
        x="100"
        y="138"
        textAnchor="middle"
        fontFamily="var(--font-display), Georgia, serif"
        fontWeight="700"
        fontSize="120"
        fill={letter}
      >
        P
      </text>

      {/* ── Balanza de la justicia ── */}
      <g stroke={figure} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        {/* Columna central */}
        <line x1="100" y1="52" x2="100" y2="150" />
        {/* Remate superior */}
        <circle cx="100" cy="50" r="5" fill={figure} stroke="none" />
        {/* Viga horizontal */}
        <line x1="48" y1="70" x2="152" y2="70" />
        {/* Nudo central de la viga */}
        <circle cx="100" cy="70" r="6" fill={figure} stroke="none" />

        {/* Cadenas izquierda */}
        <line x1="48" y1="70" x2="32" y2="112" />
        <line x1="48" y1="70" x2="64" y2="112" />
        {/* Cadenas derecha */}
        <line x1="152" y1="70" x2="136" y2="112" />
        <line x1="152" y1="70" x2="168" y2="112" />

        {/* Base / pie */}
        <line x1="74" y1="152" x2="126" y2="152" />
      </g>

      {/* Platillos (relleno) */}
      <g fill={figure}>
        {/* Platillo izquierdo */}
        <path d="M28 112 a20 10 0 0 0 40 0 Z" />
        {/* Platillo derecho */}
        <path d="M132 112 a20 10 0 0 0 40 0 Z" />
      </g>
    </svg>
  );
}
