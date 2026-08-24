'use client';

import { Globe, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface IndicadorVisibilidadProps {
  visibilidad: 'privada' | 'publica';
  /** true cuando el autor del evento es el usuario autenticado */
  esPropio: boolean;
}

export function IndicadorVisibilidad({ visibilidad, esPropio }: IndicadorVisibilidadProps) {
  const t = useTranslations('agendaVisibilidad');

  if (!esPropio) return null;

  if (visibilidad === 'privada') {
    return (
      <Lock
        className="size-4 text-[var(--color-text-muted)]"
        aria-label={t('indicador_privada')}
      />
    );
  }

  return (
    <Globe
      className="size-4 text-[var(--color-text-secondary)]"
      aria-label={t('indicador_publica')}
    />
  );
}
