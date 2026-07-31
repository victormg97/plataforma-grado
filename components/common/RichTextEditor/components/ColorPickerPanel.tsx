'use client';

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';

// ─── Preset colors (universal, no tenant-specific colors) ─────────────────────

const PRESET_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#ffffff',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff',
  '#9900ff', '#ff00ff', '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3',
  '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc', '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599',
  '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd', '#cc4125', '#e06666',
  '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0',
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ColorPickerPanelProps {
  currentColor: string;
  onSelect: (color: string) => void;
  onClose: () => void;
  mode: 'text' | 'background';
  /** Ref to the trigger button — used to position the portal */
  triggerRef: React.RefObject<HTMLElement | null>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ColorPickerPanel({ currentColor, onSelect, onClose, mode, triggerRef }: ColorPickerPanelProps) {
  const t = useTranslations('notas');
  const [hue, setHue] = useState(0);
  const [customColor, setCustomColor] = useState(currentColor || '#000000');
  const satBrightRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<'sb' | 'hue' | null>(null);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const [sat, setSat] = useState(1);
  const [bright, setBright] = useState(1);

  useEffect(() => { setMounted(true); }, []); // eslint-disable-line react-hooks/set-state-in-effect

  // Position the panel below the trigger
  useLayoutEffect(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const panelWidth = 260;
    let left = rect.left + rect.width / 2 - panelWidth / 2;
    // Clamp so it doesn't overflow viewport
    left = Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8));
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow > 380 ? rect.bottom + 6 : rect.top - 380;
    setPos({ top: Math.max(8, top), left });
  }, [triggerRef]);

  // Sync customColor when dragging
  useEffect(() => {
    if (dragging.current) {
      const hex = hsvToHex(hue, sat, bright);
      setCustomColor(hex); // eslint-disable-line react-hooks/set-state-in-effect -- intentional: sync derived state while dragging
    }
  }, [hue, sat, bright]);

  // Close on outside click (capture phase to catch events before preventDefault)
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (
        !panelRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Use pointerdown in capture phase — fires before any preventDefault
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handler, true);
      document.addEventListener('keydown', keyHandler);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handler, true);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose, triggerRef]);

  const handleSBMove = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!satBrightRef.current) return;
    const rect = satBrightRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setSat(x);
    setBright(1 - y);
  }, []);

  const handleHueMove = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!hueRef.current) return;
    const rect = hueRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHue(Math.round(x * 360));
  }, []);

  const startDrag = useCallback((target: 'sb' | 'hue', e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = target;
    if (target === 'sb') handleSBMove(e);
    else handleHueMove(e);

    const onMove = (ev: MouseEvent) => {
      if (target === 'sb') handleSBMove(ev);
      else handleHueMove(ev);
    };
    const onUp = () => {
      dragging.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [handleSBMove, handleHueMove]);

  const handlePresetClick = (color: string) => {
    setCustomColor(color);
    onSelect(color);
    onClose();
  };

  const handleCustomApply = () => {
    onSelect(customColor);
    onClose();
  };

  const handleRemoveColor = () => {
    onSelect('');
    onClose();
  };

  const handleHexInput = (value: string) => {
    setCustomColor(value);
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      onSelect(value);
    }
  };

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 99995 }}
      className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-lg)] w-[260px] overflow-hidden"
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
        <span className="text-xs font-medium text-[var(--color-text-primary)]">
          {mode === 'text' ? t('color_texto') : t('resaltar')}
        </span>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onClose(); }}
          className="flex items-center justify-center size-5 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
        >
          <X className="size-3" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Saturation/Brightness area */}
        <div
          ref={satBrightRef}
          className="relative h-[120px] w-full rounded-[var(--radius-sm)] cursor-crosshair overflow-hidden"
          style={{ backgroundColor: `hsl(${hue}, 100%, 50%)` }}
          onMouseDown={(e) => startDrag('sb', e)}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black" />
          <div
            className="absolute size-3.5 rounded-full border-2 border-white shadow-[0_0_2px_rgba(0,0,0,0.5)] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: `${sat * 100}%`, top: `${(1 - bright) * 100}%` }}
          />
        </div>

        {/* Hue bar */}
        <div
          ref={hueRef}
          className="relative h-3 w-full rounded-full cursor-pointer"
          style={{ background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)' }}
          onMouseDown={(e) => startDrag('hue', e)}
        >
          <div
            className="absolute top-1/2 size-3.5 rounded-full border-2 border-white shadow-[0_0_2px_rgba(0,0,0,0.5)] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: `${(hue / 360) * 100}%` }}
          />
        </div>

        {/* Hex input + preview + apply */}
        <div className="flex items-center gap-2">
          <div
            className="size-7 rounded-[var(--radius-sm)] border border-[var(--color-border)] shrink-0"
            style={{ backgroundColor: customColor }}
          />
          <input
            type="text"
            value={customColor}
            onChange={(e) => handleHexInput(e.target.value)}
            className="flex-1 h-7 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-2 text-xs text-[var(--color-text-primary)] font-mono focus:outline-none focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)]/30"
            placeholder="#000000"
          />
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); handleCustomApply(); }}
            className="h-7 px-2 rounded-[var(--radius-sm)] bg-[var(--color-brand-gold)] text-white text-xs font-medium hover:opacity-90"
          >
            OK
          </button>
        </div>

        {/* Preset grid */}
        <div>
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">Presets</p>
          <div className="grid grid-cols-10 gap-1">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handlePresetClick(color); }}
                className={`size-5 rounded-sm border transition-transform hover:scale-125 ${
                  currentColor === color ? 'border-[var(--color-brand-gold)] ring-1 ring-[var(--color-brand-gold)]/40' : 'border-[var(--color-border)]'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>

        {/* Remove color button */}
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); handleRemoveColor(); }}
          className="w-full h-7 rounded-[var(--radius-sm)] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          {mode === 'text' ? t('color_predeterminado') : t('sin_resaltado')}
        </button>
      </div>
    </div>,
    document.body
  );
}
