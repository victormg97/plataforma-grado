'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { m } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Check, X, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

type Placement = 'below' | 'above';

function calcPosition(
  anchor: HTMLElement,
  popupH: number,
  popupW: number,
): { top: number; left: number; placement: Placement } {
  const r = anchor.getBoundingClientRect();
  const vH = window.innerHeight;
  const vW = window.innerWidth;
  const placement: Placement = vH - r.bottom >= popupH + 8 ? 'below' : 'above';
  const top = placement === 'below' ? r.bottom + 8 : r.top - popupH - 8;
  let left = r.left + r.width / 2 - popupW / 2;
  left = Math.max(8, Math.min(left, vW - popupW - 8));
  return { top, left, placement };
}

export type PagoEstado = 'pagado' | 'parcial' | null;

export interface PagoPopupProps {
  /** Anchor element ref — popup will position relative to it */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Current payment state for this cell */
  estado: PagoEstado;
  monto_pagado: number | null;
  alumnoNombre: string;
  mesLabel: string;
  /** Called with the selected action */
  onSave: (estado: 'pagado' | 'parcial' | 'pendiente', monto?: number) => void;
  onClose: () => void;
  /** When set, popup works in "mark entire column" mode */
  columnMode?: { alumnosCount: number };
}

export function PagoPopup({
  anchorRef,
  estado,
  monto_pagado,
  alumnoNombre,
  mesLabel,
  onSave,
  onClose,
  columnMode,
}: PagoPopupProps) {
  const t = useTranslations('pagos');
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [monto, setMonto] = useState(monto_pagado != null ? String(monto_pagado) : '');

  // Estimate placement synchronously so initial animation direction is correct
  // eslint-disable-next-line react-hooks/refs
  const [pos, setPos] = useState<{ top: number; left: number; placement: Placement }>(() => {
    if (typeof window === 'undefined' || !anchorRef.current)
      return { top: 0, left: 0, placement: 'below' };
    return calcPosition(anchorRef.current, 220, 240);
  });

  // Re-calc with actual popup dimensions after first paint
  useLayoutEffect(() => {
    if (anchorRef.current && popupRef.current) {
      setPos(calcPosition(anchorRef.current, popupRef.current.offsetHeight, popupRef.current.offsetWidth));
    }
  }, [anchorRef]);

  // Focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        popupRef.current && !popupRef.current.contains(target) &&
        anchorRef.current && !anchorRef.current.contains(target)
      ) {
        onClose();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [onClose, anchorRef]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleMontoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits
    const val = e.target.value.replace(/[^0-9]/g, '');
    setMonto(val);
  };

  const handleSavePagado = () => {
    const montoNum = monto ? parseInt(monto, 10) : undefined;
    onSave('pagado', montoNum && montoNum > 0 ? montoNum : undefined);
  };

  const handleSaveParcial = () => {
    const montoNum = monto ? parseInt(monto, 10) : undefined;
    onSave('parcial', montoNum && montoNum > 0 ? montoNum : undefined);
  };

  const handleUnmark = () => {
    onSave('pendiente');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSavePagado();
    }
  };

  const isPaid = !columnMode && (estado === 'pagado' || estado === 'parcial');

  const transformOrigin = pos.placement === 'below' ? 'top center' : 'bottom center';
  const yOffset = pos.placement === 'below' ? -6 : 6;

  const arrowClass = pos.placement === 'below'
    ? 'bottom-full left-1/2 -translate-x-1/2 border-b-[var(--color-bg-elevated)] border-t-transparent border-l-transparent border-r-transparent'
    : 'top-full left-1/2 -translate-x-1/2 border-t-[var(--color-bg-elevated)] border-b-transparent border-l-transparent border-r-transparent';

  return (
    <m.div
      ref={popupRef}
      role="dialog"
      aria-modal="false"
      aria-label={columnMode ? mesLabel : `${alumnoNombre} — ${mesLabel}`}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 50, transformOrigin }}
      initial={{ opacity: 0, scale: 0.88, y: yOffset }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.88, y: yOffset }}
      transition={{ type: 'spring', stiffness: 380, damping: 26, mass: 0.7 }}
      className="w-56 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[var(--shadow-lg)]"
    >
      {/* Arrow */}
      <div
        className={cn(
          'pointer-events-none absolute size-0 border-8',
          arrowClass,
          'hidden sm:block'
        )}
      />

      <div className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {mesLabel}
            </p>
            {columnMode ? (
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                {t('columna_subtitle', { count: columnMode.alumnosCount })}
              </p>
            ) : (
              <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                {alumnoNombre}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-2 flex size-6 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
            aria-label="Cerrar"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Amount input */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-[var(--color-text-muted)]">
            {t('monto_label')}
            <span className="ml-1 text-[10px] opacity-70">(opcional)</span>
          </label>
          <div className="relative">
            <DollarSign className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={monto}
              onChange={handleMontoChange}
              onKeyDown={handleKeyDown}
              placeholder={t('monto_placeholder')}
              className={cn(
                'h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]',
                'pl-7 pr-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
                'focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]'
              )}
            />
          </div>
        </div>

        {/* Action buttons */}
        {columnMode ? (
          <div className="flex flex-col gap-2">
            <button
              onClick={handleSavePagado}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] py-2 text-sm font-semibold transition-colors',
                'bg-[var(--color-success)] text-white hover:opacity-90 active:scale-95'
              )}
            >
              <Check className="size-4" />
              {t('marcar_todo')}
            </button>
            <button
              onClick={handleUnmark}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] py-2 text-sm font-semibold transition-colors',
                'border border-[var(--color-error)] text-[var(--color-error)] hover:bg-[var(--color-error)] hover:text-white active:scale-95'
              )}
            >
              <X className="size-4" />
              {t('desmarcar_todo')}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {!isPaid ? (
              <div className="flex gap-2">
                <button
                  onClick={handleSavePagado}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-md)] py-2 text-sm font-semibold transition-colors',
                    'bg-[var(--color-success)] text-white hover:opacity-90 active:scale-95'
                  )}
                >
                  <Check className="size-4" />
                  {t('marcar_pagado')}
                </button>
                <button
                  onClick={handleSaveParcial}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] px-3 py-2 text-sm font-semibold transition-colors',
                    'bg-[var(--color-partial-muted)] text-[var(--color-partial)] hover:opacity-80 active:scale-95'
                  )}
                >
                  {t('marcar_parcial')}
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={estado === 'pagado' ? handleSaveParcial : handleSavePagado}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-md)] py-2 text-sm font-semibold transition-colors active:scale-95',
                    estado === 'pagado'
                      ? 'bg-[var(--color-partial-muted)] text-[var(--color-partial)] hover:opacity-80'
                      : 'bg-[var(--color-success)] text-white hover:opacity-90'
                  )}
                >
                  {estado === 'pagado' ? t('marcar_parcial') : (<><Check className="size-4" /> {t('marcar_pagado')}</>)}
                </button>
                <button
                  onClick={handleUnmark}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] px-3 py-2 text-sm font-semibold transition-colors',
                    'border border-[var(--color-error)] text-[var(--color-error)] hover:bg-[var(--color-error)] hover:text-white active:scale-95'
                  )}
                  aria-label={t('desmarcar')}
                >
                  <X className="size-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Current status indicator (cell mode only) */}
        {!columnMode && isPaid && (
          <p className="text-center text-[11px] text-[var(--color-text-muted)]">
            {estado === 'pagado' ? t('estado_pagado') : t('estado_parcial')}
            {monto_pagado != null && ` · $${monto_pagado.toLocaleString('es-CL')}`}
          </p>
        )}
      </div>
    </m.div>
  );
}
