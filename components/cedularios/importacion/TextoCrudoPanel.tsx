'use client';

import { useId, useState } from 'react';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/common/Button';

interface TextoCrudoPanelProps {
  texto: string;
  onReparsear: (texto: string) => void;
}

/** Source text of the file. Editing it and re-parsing replaces the tree (undoable). */
export function TextoCrudoPanel({ texto, onReparsear }: TextoCrudoPanelProps) {
  const t = useTranslations('cedularios.importacion.texto');
  const idPanel = useId();
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState(texto);
  const [base, setBase] = useState(texto);

  // A new file (or a re-parse) replaces the draft.
  if (base !== texto) {
    setBase(texto);
    setBorrador(texto);
  }

  const modificado = borrador !== texto;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-controls={idPanel}
        className="flex items-center gap-1.5 self-start rounded-[var(--radius-sm)] text-sm font-medium text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]"
      >
        {abierto ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
        {t('titulo')}
      </button>
      {abierto && (
        <div id={idPanel} className="flex flex-col gap-2">
          <p className="text-xs text-[var(--color-text-muted)]">{t('ayuda')}</p>
          <textarea
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            aria-label={t('aria')}
            rows={12}
            spellCheck={false}
            className="w-full resize-y rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] p-3 font-mono text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-gold)] focus:ring-2 focus:ring-[var(--color-brand-gold)]/20"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-[var(--color-text-muted)]">{modificado ? t('advertencia_reemplaza') : ''}</p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              icon={<RefreshCw className="size-4" aria-hidden="true" />}
              onClick={() => onReparsear(borrador)}
            >
              {t('reanalizar')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
