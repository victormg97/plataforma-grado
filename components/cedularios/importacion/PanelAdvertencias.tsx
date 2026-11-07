'use client';

import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Advertencia, MateriaPlana } from '@/lib/cedularios/importacion';
import { cn } from '@/lib/utils';

interface PanelAdvertenciasProps {
  advertencias: readonly Advertencia[];
  planas: readonly MateriaPlana[];
  /** Called with the item key when a finding that points to an item is activated. */
  onIr: (nodoKey: string) => void;
}

/** Findings of the parser and the live validation. Errors first; items with a key are clickable. */
export function PanelAdvertencias({ advertencias, planas, onIr }: PanelAdvertenciasProps) {
  const t = useTranslations('cedularios.importacion.advertencias');
  const porKey = useMemo(() => new Map(planas.map((p) => [p.key, p])), [planas]);
  const ordenadas = useMemo(
    () => [...advertencias].sort((a, b) => (a.severidad === b.severidad ? 0 : a.severidad === 'error' ? -1 : 1)),
    [advertencias],
  );
  const errores = advertencias.filter((a) => a.severidad === 'error').length;
  const avisos = advertencias.length - errores;

  if (advertencias.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]" role="status">
        <CheckCircle2 className="size-4 text-[var(--color-success)]" aria-hidden="true" />
        {t('ninguna')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-[var(--color-text-primary)]" role="status" aria-live="polite">
        {t('resumen', { errores, avisos })}
      </p>
      <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
        {ordenadas.map((a, i) => {
          const nodo = a.nodoKey !== undefined ? porKey.get(a.nodoKey) : undefined;
          const esError = a.severidad === 'error';
          const Icono = esError ? XCircle : AlertTriangle;
          const texto = t(`tipos.${a.tipo}`, a.params ?? {});
          const contenido = (
            <>
              <Icono
                className={cn('mt-0.5 size-4 shrink-0', esError ? 'text-[var(--color-error)]' : 'text-[var(--color-warning)]')}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="sr-only">{esError ? t('error') : t('aviso')}: </span>
                {nodo && (
                  <span className="mr-1 font-medium tabular-nums text-[var(--color-text-muted)]">{nodo.codigo}</span>
                )}
                <span className="text-[var(--color-text-primary)]">{texto}</span>
                {nodo && nodo.nombre.trim() !== '' && (
                  <span className="block truncate text-xs text-[var(--color-text-muted)]">{nodo.nombre}</span>
                )}
                {!nodo && a.linea !== undefined && (
                  <span className="block text-xs text-[var(--color-text-muted)]">{t('linea', { linea: a.linea })}</span>
                )}
              </span>
            </>
          );
          return (
            <li key={`${a.tipo}-${a.nodoKey ?? 'g'}-${i}`}>
              {nodo ? (
                <button
                  type="button"
                  onClick={() => onIr(nodo.key)}
                  aria-label={t('ir_aria', { codigo: nodo.codigo })}
                  className="flex w-full items-start gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-sm hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]"
                >
                  {contenido}
                </button>
              ) : (
                <div className="flex items-start gap-2 px-2 py-1.5 text-sm">{contenido}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
