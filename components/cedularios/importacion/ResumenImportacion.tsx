'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { MateriaPlana } from '@/lib/cedularios/importacion';

interface ResumenImportacionProps {
  planas: readonly MateriaPlana[];
}

/** Total and per-nivel counts of the tree about to be imported. */
export function ResumenImportacion({ planas }: ResumenImportacionProps) {
  const t = useTranslations('cedularios.importacion.resumen');
  const porNivel = useMemo(() => {
    const cuenta = new Map<number, number>();
    for (const p of planas) cuenta.set(p.depth, (cuenta.get(p.depth) ?? 0) + 1);
    return [...cuenta.entries()].sort((a, b) => a[0] - b[0]);
  }, [planas]);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-[var(--color-text-primary)]">{t('total', { count: planas.length })}</p>
      <ul className="flex flex-wrap gap-2" aria-label={t('por_nivel_aria')}>
        {porNivel.map(([nivel, cantidad]) => (
          <li
            key={nivel}
            className="rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]"
          >
            {t('nivel', { nivel, count: cantidad })}
          </li>
        ))}
      </ul>
    </div>
  );
}
