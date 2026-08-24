'use client';

import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface BotonConexionProps {
  enlace: string | null;
}

export function BotonConexion({ enlace }: BotonConexionProps) {
  const t = useTranslations('agendaConexion');

  if (!enlace) return null;

  return (
    <a
      href={enlace}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('abrir_aria')}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-info)] hover:underline"
    >
      <ExternalLink className="size-4" />
      {t('abrir')}
    </a>
  );
}
