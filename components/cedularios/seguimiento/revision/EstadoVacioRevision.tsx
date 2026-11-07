'use client';

/**
 * Empty state of the Revisor when the assignment has no assigned materias.
 * In edit mode it offers the "edit assigned materias" action.
 */

import { ListChecks } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/common/Button';
import { cn } from '@/lib/utils';
import { useSegUrl } from '../url/useSegUrl';

interface EstadoVacioRevisionProps {
  /** True in edit mode; false hides the action and uses the read-only text. */
  editable: boolean;
  alumnoId: string;
  cedularioId: string;
  className?: string;
}

export function EstadoVacioRevision({
  editable,
  alumnoId,
  cedularioId,
  className,
}: EstadoVacioRevisionProps) {
  const t = useTranslations('cedularios.seguimiento.revision.sin_asignadas');
  const { abrir } = useSegUrl();

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-4 py-10 text-center',
        className,
      )}
    >
      <ListChecks className="size-10 text-[var(--color-text-muted)]" aria-hidden="true" />
      <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{t('titulo')}</h3>
      <p className="max-w-sm text-sm text-[var(--color-text-muted)]">
        {editable ? t('descripcion') : t('descripcion_lectura')}
      </p>
      {editable && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => abrir({ modal: 'editar_materias', alumno: alumnoId, cedulario: cedularioId })}
        >
          {t('editar_materias')}
        </Button>
      )}
    </div>
  );
}
