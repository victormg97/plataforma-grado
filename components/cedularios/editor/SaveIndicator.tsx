'use client';

/**
 * Autosave status line (Req 13.12, 13.13).
 *
 * - "Guardando..." while a write is in flight.
 * - "Guardado" while `guardadoVisible` is true (the hook keeps it for 1000 ms).
 * - "Cambios sin guardar" while there is text that was not persisted.
 * - On `fase === 'error'`: the message of the cause (`errores.<code>`, for an oversized
 *   document the 200000-byte limit message) and a Retry button. The field stays editable.
 */

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Check, Loader } from 'lucide-react';

import type { ActionError } from '@/lib/cedularios/action-result';
import type { AutosaveFase } from '@/lib/cedularios/autosave';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

import { useCedulariosAction } from '../hooks/useCedulariosAction';

export interface SaveIndicatorProps {
  fase: AutosaveFase;
  guardadoVisible: boolean;
  hayCambiosSinGuardar: boolean;
  /** Error of the failed save; only meaningful when `fase === 'error'`. */
  error: ActionError | null;
  onReintentar: () => void;
  className?: string;
}

export function SaveIndicator({
  fase,
  guardadoVisible,
  hayCambiosSinGuardar,
  error,
  onReintentar,
  className,
}: SaveIndicatorProps) {
  const t = useTranslations('cedularios');
  const { translateError } = useCedulariosAction();

  if (fase === 'error') {
    return (
      <div
        role="alert"
        className={cn('flex flex-wrap items-center gap-2 text-sm text-destructive', className)}
      >
        <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
        <span>{error ? translateError(error) : t('editor.error_guardado')}</span>
        <Button type="button" variant="outline" size="xs" onClick={onReintentar}>
          {t('editor.reintentar')}
        </Button>
      </div>
    );
  }

  let contenido: ReactNode = null;
  if (fase === 'guardando') {
    contenido = (
      <>
        <Loader className="size-3.5 animate-spin" aria-hidden="true" />
        {t('editor.guardando')}
      </>
    );
  } else if (guardadoVisible) {
    contenido = (
      <>
        <Check className="size-3.5" aria-hidden="true" />
        {t('editor.guardado')}
      </>
    );
  } else if (fase === 'pendiente' || hayCambiosSinGuardar) {
    contenido = t('editor.sin_guardar');
  }

  // The live region is always rendered so screen readers announce the changes.
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex min-h-5 items-center gap-1.5 text-xs text-muted-foreground', className)}
    >
      {contenido}
    </div>
  );
}
