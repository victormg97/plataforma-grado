'use client';

/** Footer of the assign wizard: cancel, back and next/confirm, or close for a notice. */

import { useTranslations } from 'next-intl';
import { Button } from '@/components/common/Button';
import type { ModoWizard } from '@/lib/cedularios/seguimiento/asignacion-wizard';
import type { Bloqueo } from './asignarWizardTipos';

interface WizardPieProps {
  modo: ModoWizard;
  bloqueo: Bloqueo | null;
  /** False while a result is shown (it carries its own actions). */
  mostrarPasos: boolean;
  enviando: boolean;
  primerPaso: boolean;
  ultimoPaso: boolean;
  onCerrar: () => void;
  onSolicitarCierre: () => void;
  onAtras: () => void;
  onSiguiente: () => void;
  onGuardar: () => void;
}

const CLASE_PIE = 'border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-[var(--space-md)]';

export function WizardPie({
  modo,
  bloqueo,
  mostrarPasos,
  enviando,
  primerPaso,
  ultimoPaso,
  onCerrar,
  onSolicitarCierre,
  onAtras,
  onSiguiente,
  onGuardar,
}: WizardPieProps) {
  const t = useTranslations('cedularios.seguimiento');
  const tw = useTranslations('cedularios.seguimiento.asignar.wizard');

  if (mostrarPasos) {
    return (
      <footer
        className={`flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between ${CLASE_PIE}`}
      >
        <Button type="button" variant="ghost" onClick={onSolicitarCierre} disabled={enviando}>
          {t('comun.cancelar')}
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            onClick={onAtras}
            disabled={enviando || primerPaso}
          >
            {tw('atras')}
          </Button>
          {ultimoPaso ? (
            <Button type="button" onClick={onGuardar} loading={enviando}>
              {enviando
                ? t('asignar.asignando')
                : modo === 'reasignar'
                  ? t('asignar.confirmar_reasignar')
                  : t('asignar.confirmar')}
            </Button>
          ) : (
            <Button type="button" onClick={onSiguiente} disabled={enviando}>
              {tw('siguiente')}
            </Button>
          )}
        </div>
      </footer>
    );
  }

  if (bloqueo) {
    return (
      <footer className={`flex justify-end ${CLASE_PIE}`}>
        <Button type="button" variant="ghost" onClick={onCerrar}>
          {t('comun.cerrar')}
        </Button>
      </footer>
    );
  }

  return null;
}
