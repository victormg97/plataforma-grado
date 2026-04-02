'use client';

import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

interface GraduadoEffectProps {
  active: boolean;
}

export function GraduadoEffect({ active }: GraduadoEffectProps) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasFiredRef = useRef(false);

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      hasFiredRef.current = false;
      return;
    }

    const goldColors = ['#C9993F', '#E8C97A', '#F5D78A', '#FFE4A0', '#ffffff'];

    const fire = (particleRatio: number, opts: confetti.Options) => {
      confetti({
        origin: { x: 0.5, y: 0.6 },
        colors: goldColors,
        ...opts,
        particleCount: Math.floor(200 * particleRatio),
      });
    };

    // Initial burst when activated
    if (!hasFiredRef.current) {
      hasFiredRef.current = true;
      fire(0.25, { spread: 26, startVelocity: 55 });
      fire(0.2, { spread: 60 });
      fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
      fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
      fire(0.1, { spread: 120, startVelocity: 45 });
    }

    // Subtle ongoing trickle
    intervalRef.current = setInterval(() => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.65 },
        colors: goldColors,
        scalar: 0.9,
        gravity: 0.8,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.65 },
        colors: goldColors,
        scalar: 0.9,
        gravity: 0.8,
      });
    }, 2500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active]);

  if (!active) return null;

  return (
    <>
      {/* Floating particles CSS layer */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        style={{ willChange: 'transform' }}
      >
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full opacity-0"
            style={{
              width: `${4 + (i % 4) * 2}px`,
              height: `${4 + (i % 4) * 2}px`,
              background: i % 3 === 0 ? '#C9993F' : i % 3 === 1 ? '#E8C97A' : '#fff',
              left: `${8 + i * 7.5}%`,
              top: `${15 + (i % 5) * 12}%`,
              animation: `floatParticle ${3 + (i % 4)}s ${i * 0.4}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes floatParticle {
          0%   { opacity: 0; transform: translateY(0) rotate(0deg); }
          20%  { opacity: 0.7; }
          50%  { opacity: 0.5; transform: translateY(-30px) rotate(180deg); }
          80%  { opacity: 0.3; }
          100% { opacity: 0; transform: translateY(-60px) rotate(360deg); }
        }
      `}</style>
    </>
  );
}
