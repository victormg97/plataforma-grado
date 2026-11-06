'use client';

import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface UniversidadLogoProps {
  url: string | null;
  nombre: string;
  /** Size and shape classes, for example `size-14`. */
  className?: string;
}

/**
 * Logo thumbnail, or a placeholder when the universidad has no logo (or the image fails to load).
 * A plain `<img>` with no background fill, so transparent areas of PNG, WEBP, GIF, AVIF and SVG
 * are preserved (Requirement 1.6).
 */
export function UniversidadLogo({ url, nombre, className }: UniversidadLogoProps) {
  const t = useTranslations('cedularios');
  // URL that failed to load. A new URL is tried again.
  const [urlRota, setUrlRota] = useState<string | null>(null);

  const mostrarImagen = url !== null && url !== '' && urlRota !== url;

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]',
        className,
      )}
    >
      {mostrarImagen ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={t('universidades.logo_alt', { nombre })}
          className="size-full object-contain p-1"
          onError={() => setUrlRota(url)}
        />
      ) : (
        <div
          role="img"
          aria-label={t('universidades.sin_logo')}
          className="flex size-full items-center justify-center bg-[var(--color-bg-secondary)]"
        >
          <Building2 className="size-1/2 text-[var(--color-text-muted)]" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
