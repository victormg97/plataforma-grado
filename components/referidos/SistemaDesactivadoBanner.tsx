'use client';

import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import Link from 'next/link';

interface SistemaDesactivadoBannerProps {
  displayName: string;
  isAdmin: boolean;
  configHref?: string;
}

export function SistemaDesactivadoBanner({ displayName, isAdmin, configHref }: SistemaDesactivadoBannerProps) {
  const t = useTranslations('referidos');

  return (
    <Card className="p-4 bg-[var(--color-warning)]/10 border-[var(--color-warning)]/30 flex items-center justify-between">
      <div className="flex items-center gap-3 text-[var(--color-warning)]">
        <AlertCircle className="size-5" />
        <p className="font-medium">{t('sistema_desactivado', { nombre: displayName })}</p>
      </div>
      {isAdmin && configHref && (
        <Link href={configHref}>
          <Button variant="secondary" size="sm" className="border-[var(--color-warning)] text-[var(--color-warning)] hover:bg-[var(--color-warning)]/10">
            {t('ir_a_configuracion')}
          </Button>
        </Link>
      )}
    </Card>
  );
}
