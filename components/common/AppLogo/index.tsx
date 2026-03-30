'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

interface AppLogoProps {
  /** 'sidebar' = compact horizontal, 'login' = large centered */
  variant?: 'sidebar' | 'login';
  className?: string;
}

export function AppLogo({ variant = 'sidebar', className }: AppLogoProps) {
  const [imgError, setImgError] = useState(false);
  const { resolvedTheme } = useTheme();

  // resolvedTheme is undefined during SSR; falls back to light safely.
  const logoSrc = resolvedTheme === 'dark'
    ? '/assets/logo-dark.png'
    : '/assets/logo-light.png';

  if (variant === 'login') {
    if (imgError) {
      return (
        <div className={cn('flex flex-col items-center', className)}>
          <span
            className="text-[clamp(1.75rem,5vw,2.5rem)] font-bold text-[var(--color-brand-gold)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            CTA Graduados
          </span>
        </div>
      );
    }
    return (
      <div className={cn('flex flex-col items-center', className)}>
        <div className="w-[clamp(100px,30vw,160px)]">
          <Image
            src={logoSrc}
            alt="CTA Graduados"
            width={160}
            height={80}
            style={{ width: '100%', height: 'auto' }}
            onError={() => setImgError(true)}
            priority
          />
        </div>
      </div>
    );
  }

  // sidebar variant
  if (imgError) {
    return (
      <span
        className={cn('text-lg font-bold text-[var(--color-brand-gold)]', className)}
        style={{ fontFamily: 'var(--font-display)' }}
      >
        CTA Graduados
      </span>
    );
  }

  return (
    <div className={cn(className)}>
      <Image
        src={logoSrc}
        alt="CTA Graduados"
        width={140}
        height={46}
        style={{ width: 'auto', height: '38px' }}
        onError={() => setImgError(true)}
        priority
      />
    </div>
  );
}
