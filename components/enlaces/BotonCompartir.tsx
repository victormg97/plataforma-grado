'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Link2, Check } from 'lucide-react';
import { Tooltip } from '@/components/common/Tooltip';
import { construirUrlEnlace } from '@/lib/enlaces/compartir';
import { tenantConfig } from '@/config';

interface BotonCompartirProps {
  codigo: string;
  /** Etiqueta accesible / tooltip del control. */
  label: string;
}

const POPOVER_MS = 2000;

export function BotonCompartir({ codigo, label }: BotonCompartirProps) {
  const t = useTranslations('enlaces');
  const [copiado, setCopiado] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const base =
    (typeof window !== 'undefined' && window.location.origin) ||
    process.env.NEXT_PUBLIC_APP_URL ||
    tenantConfig.id;

  const handleCompartir = async () => {
    const url = construirUrlEnlace(base, codigo);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard no disponible');
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopiado(false), POPOVER_MS);
    } catch {
      toast.error(t('error_copiar'));
    }
  };

  return (
    <span className="relative inline-flex">
      <Tooltip content={label} position="top">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleCompartir();
          }}
          aria-label={label}
          className="flex size-9 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <Link2 className="size-4" />
        </button>
      </Tooltip>
      {copiado && (
        <span
          role="status"
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-[var(--radius-sm)] bg-[var(--color-success)] px-2 py-1 text-xs font-medium text-white shadow-[var(--shadow-md)]"
        >
          <Check className="size-3" />
          {t('copiado')}
        </span>
      )}
    </span>
  );
}
