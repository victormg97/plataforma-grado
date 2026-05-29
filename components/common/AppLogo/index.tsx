'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useTenant } from '@/config/client';

interface AppLogoProps {
  /** 'sidebar' = compact horizontal, 'login' = large centered */
  variant?: 'sidebar' | 'login';
  className?: string;
  /** Inline styles aplicados al contenedor raíz (útil para controlar max-height dinámicamente) */
  style?: CSSProperties;
}

export function AppLogo({ variant = 'sidebar', className, style }: AppLogoProps) {
  const [imgError, setImgError] = useState(false);
  const { resolvedTheme } = useTheme();
  const tenant = useTenant();

  // resolvedTheme is undefined during SSR; falls back to light safely.
  const isDark = resolvedTheme === 'dark';

  // En el sidebar se prefiere el logo específico del sidebar si el tenant lo
  // define; si no, cae al logo principal. En login siempre se usa el principal.
  const sidebarSrc = isDark
    ? tenant.sidebarDark ?? tenant.logoDark
    : tenant.sidebarLight ?? tenant.logoLight;

  const logoSrc = variant === 'sidebar'
    ? sidebarSrc
    : isDark
      ? tenant.logoDark
      : tenant.logoLight;

  if (variant === 'login') {
    if (imgError) {
      return (
        <div className={cn('flex flex-col items-center', className)} style={style}>
          <span
            className="text-[clamp(1.75rem,5vw,2.5rem)] font-bold text-[var(--color-brand-gold)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {tenant.nombre}
          </span>
        </div>
      );
    }
    return (
      <div className={cn('flex flex-col items-center', className)} style={style}>
        <div className="w-[clamp(100px,30vw,160px)]" style={{ maxHeight: style?.maxHeight, overflow: 'hidden' }}>
          <Image
            src={logoSrc}
            alt={tenant.nombre}
            width={160}
            height={80}
            style={{ width: '100%', height: 'auto', maxHeight: style?.maxHeight, objectFit: 'contain' }}
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
        {tenant.nombre}
      </span>
    );
  }

  return (
    <div className={cn(className)}>
      <Image
        src={logoSrc}
        alt={tenant.nombre}
        width={140}
        height={46}
        style={{ width: 'auto', height: '38px' }}
        onError={() => setImgError(true)}
        priority
      />
    </div>
  );
}
