'use client';

/**
 * Notice shown in edit mode when the cedulario has active materias that are
 * not assigned to the student. The action opens the subset editor through the
 * `seg_*` URL state. The parent decides when to render it (edit mode only).
 */

import { ListPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/common/Button';
import { cn } from '@/lib/utils';
import { useSegUrl } from '../url/useSegUrl';

interface IndicadorSinAsignarProps {
  /** Number of active materias of the cedulario that are not assigned. */
  cantidad: number;
  alumnoId: string;
  cedularioId: string;
  className?: string;
}

export function IndicadorSinAsignar({
  cantidad,
  alumnoId,
  cedularioId,
  className,
}: IndicadorSinAsignarProps) {
  const t = useTranslations('cedularios.seguimiento.revision.materias_sin_asignar');
  const { abrir } = useSegUrl();

  if (cantidad <= 0) return null;

  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-brand-gold-muted)] px-3 py-2',
        className,
      )}
    >
      <p className="text-sm text-[var(--color-text-primary)]">{t('aviso', { count: cantidad })}</p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        icon={<ListPlus className="size-4" />}
        onClick={() => abrir({ modal: 'editar_materias', alumno: alumnoId, cedulario: cedularioId })}
      >
        {t('accion')}
      </Button>
    </div>
  );
}
