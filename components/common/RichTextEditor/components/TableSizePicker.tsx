'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Table as TableIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Tooltip } from '@/components/common/Tooltip';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TableSizePickerProps {
  onInsert: (rows: number, cols: number) => void;
}

const MAX_ROWS = 8;
const MAX_COLS = 8;

// ─── Component ────────────────────────────────────────────────────────────────

export function TableSizePicker({ onInsert }: TableSizePickerProps) {
  const t = useTranslations('notas');
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hoverRows, setHoverRows] = useState(0);
  const [hoverCols, setHoverCols] = useState(0);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []); // eslint-disable-line react-hooks/set-state-in-effect

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropUp = spaceBelow < 280;

    setPopoverStyle({
      position: 'fixed',
      left: rect.left,
      zIndex: 99990,
      ...(dropUp
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  };

  const openPicker = () => {
    updatePosition();
    setOpen(true);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !popoverRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (rows: number, cols: number) => {
    onInsert(rows, cols);
    setOpen(false);
    setHoverRows(0);
    setHoverCols(0);
  };

  const sizeLabel = hoverRows > 0 && hoverCols > 0
    ? t('tabla_tamano', { rows: hoverRows, cols: hoverCols })
    : t('insertar_tabla');

  const popover = open && mounted && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={popoverRef}
          style={popoverStyle}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] shadow-[var(--shadow-lg)] p-3 animate-in fade-in-0 zoom-in-95 duration-100"
        >
          {/* Size label */}
          <p className="text-xs text-center text-[var(--color-text-muted)] mb-2 font-medium">
            {sizeLabel}
          </p>

          {/* Grid */}
          <div
            className="grid gap-0.5"
            style={{ gridTemplateColumns: `repeat(${MAX_COLS}, 1fr)` }}
            onMouseLeave={() => { setHoverRows(0); setHoverCols(0); }}
          >
            {Array.from({ length: MAX_ROWS * MAX_COLS }, (_, idx) => {
              const row = Math.floor(idx / MAX_COLS) + 1;
              const col = (idx % MAX_COLS) + 1;
              const isHighlighted = row <= hoverRows && col <= hoverCols;

              return (
                <button
                  key={idx}
                  type="button"
                  onMouseEnter={() => { setHoverRows(row); setHoverCols(col); }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(row, col);
                  }}
                  className={`size-5 rounded-[2px] border transition-colors ${
                    isHighlighted
                      ? 'bg-[var(--color-brand-gold)] border-[var(--color-brand-gold)]'
                      : 'bg-[var(--color-bg-secondary)] border-[var(--color-border)] hover:border-[var(--color-brand-gold)]/50'
                  }`}
                  aria-label={`${row} × ${col}`}
                />
              );
            })}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <Tooltip content={t('insertar_tabla')} position="bottom" variant="subtle">
        <button
          ref={triggerRef}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (open) { setOpen(false); } else { openPicker(); }
          }}
          className="flex items-center justify-center h-8 w-8 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          aria-label={t('insertar_tabla')}
        >
          <TableIcon className="size-4" />
        </button>
      </Tooltip>
      {popover}
    </>
  );
}
