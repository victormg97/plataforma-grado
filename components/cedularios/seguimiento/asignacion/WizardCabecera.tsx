'use client';

/** Header of the assign wizard: title, description and the step indicator. */

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { ModoWizard, PasoWizard } from '@/lib/cedularios/seguimiento/asignacion-wizard';

interface WizardCabeceraProps {
  modo: ModoWizard;
  titulo: string;
  descripcion: string;
  /** False while a notice or a result is shown instead of the steps. */
  mostrarPasos: boolean;
  pasos: readonly PasoWizard[];
  paso: PasoWizard;
}

export function WizardCabecera({
  modo,
  titulo,
  descripcion,
  mostrarPasos,
  pasos,
  paso,
}: WizardCabeceraProps) {
  const tw = useTranslations('cedularios.seguimiento.asignar.wizard');
  const indicePaso = Math.max(0, pasos.indexOf(paso));

  const etiquetaPaso = (p: PasoWizard): string =>
    p === 'seleccion'
      ? modo === 'cedulario'
        ? tw('pasos.alumnos')
        : tw('pasos.cedularios')
      : tw(`pasos.${p}`);

  return (
    <header className="flex flex-col gap-2 border-b border-[var(--color-border)] p-[var(--space-md)] pr-12">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{titulo}</h2>
        <p className="text-sm text-[var(--color-text-muted)]">{descripcion}</p>
      </div>
      {mostrarPasos && (
        <nav aria-label={tw('pasos_aria')}>
          <p className="sr-only" aria-live="polite">
            {tw('paso_x_de_n', { actual: indicePaso + 1, total: pasos.length })}
            {': '}
            {etiquetaPaso(paso)}
          </p>
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {pasos.map((item, indice) => {
              const actual = indice === indicePaso;
              return (
                <li
                  key={item}
                  aria-current={actual ? 'step' : undefined}
                  className={cn(
                    'flex items-center gap-1.5',
                    actual
                      ? 'font-semibold text-[var(--color-text-primary)]'
                      : 'text-[var(--color-text-muted)]',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex size-5 items-center justify-center rounded-full border text-[11px]',
                      actual
                        ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold)] text-white'
                        : indice < indicePaso
                          ? 'border-[var(--color-brand-gold)] text-[var(--color-brand-gold)]'
                          : 'border-[var(--color-border)]',
                    )}
                  >
                    {indice + 1}
                  </span>
                  <span>{etiquetaPaso(item)}</span>
                  {indice < pasos.length - 1 && (
                    <span aria-hidden="true" className="ml-1 text-[var(--color-border)]">
                      /
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      )}
    </header>
  );
}
