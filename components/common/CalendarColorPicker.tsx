'use client';

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Palette, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

// ─── Preset colors optimized for calendar visibility ─────────────────────────

const PRESET_COLORS = [
  '#C9993F', '#e6b800', '#f97316', '#ef4444', '#ec4899',
  '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9',
  '#06b6d4', '#14b8a6', '#10b981', '#22c55e', '#84cc16',
  '#78716c', '#64748b', '#475569', '#1e293b', '#000000',
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalendarColorPickerProps {
  currentColor: string | null;
  onSelect: (color: string) => void;
  onReset: () => void;
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

export function CalendarColorPicker({ currentColor, onSelect, onReset }: CalendarColorPickerProps) {
  const t = useTranslations('perfil');
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const displayColor = currentColor || 'var(--color-brand-gold)';

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-primary)] hover:border-[var(--color-brand-gold)] hover:bg-[color-mix(in_srgb,var(--color-brand-gold)_4%,transparent)] transition-all group"
      >
        <div
          className="size-5 rounded-full border border-[var(--color-border)] shadow-sm group-hover:scale-110 transition-transform"
          style={{ backgroundColor: displayColor }}
        />
        <Palette className="size-3.5 text-[var(--color-text-muted)] group-hover:text-[var(--color-brand-gold)] transition-colors" />
        <span className="text-xs text-[var(--color-text-muted)]">{t('color_calendario')}</span>
      </button>

      {open && (
        <ColorPickerDropdown
          currentColor={currentColor}
          onSelect={(color) => { onSelect(color); setOpen(false); }}
          onReset={() => { onReset(); setOpen(false); }}
          onClose={() => setOpen(false)}
          triggerRef={triggerRef}
        />
      )}
    </div>
  );
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────

interface ColorPickerDropdownProps {
  currentColor: string | null;
  onSelect: (color: string) => void;
  onReset: () => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

function ColorPickerDropdown({ currentColor, onSelect, onReset, onClose, triggerRef }: ColorPickerDropdownProps) {
  const t = useTranslations('perfil');
  const [hue, setHue] = useState(0);
  const [sat, setSat] = useState(1);
  const [bright, setBright] = useState(0.7);
  const [customColor, setCustomColor] = useState(currentColor || '#C9993F');
  const satBrightRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<'sb' | 'hue' | null>(null);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => { setMounted(true); }, []); // eslint-disable-line react-hooks/set-state-in-effect

  useLayoutEffect(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const panelWidth = 280;
    let left = rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8));
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow > 420 ? rect.bottom + 6 : rect.top - 420;
    setPos({ top: Math.max(8, top), left });
  }, [triggerRef]);

  useEffect(() => {
    if (dragging.current) {
      const hex = hsvToHex(hue, sat, bright);
      setCustomColor(hex); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [hue, sat, bright]);

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
  };

  const handleCustomApply = () => {
    onSelect(customColor);
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
      className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-lg)] w-[280px] overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <Palette className="size-3.5 text-[var(--color-brand-gold)]" />
          <span className="text-xs font-medium text-[var(--color-text-primary)]">
            {t('color_calendario')}
          </span>
        </div>
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
          className="relative h-[130px] w-full rounded-[var(--radius-sm)] cursor-crosshair overflow-hidden"
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
            placeholder="#C9993F"
          />
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); handleCustomApply(); }}
            className="h-7 px-2.5 rounded-[var(--radius-sm)] bg-[var(--color-brand-gold)] text-white text-xs font-medium hover:opacity-90 transition-opacity"
          >
            OK
          </button>
        </div>

        {/* Preset grid */}
        <div>
          <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">
            {t('colores_sugeridos')}
          </p>
          <div className="grid grid-cols-10 gap-1.5">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handlePresetClick(color); }}
                className={`size-5.5 rounded-full border-2 transition-all hover:scale-125 ${
                  currentColor === color
                    ? 'border-[var(--color-brand-gold)] ring-2 ring-[var(--color-brand-gold)]/30 scale-110'
                    : 'border-transparent hover:border-[var(--color-border-strong)]'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>

        {/* Reset to default */}
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onReset(); }}
          className="w-full h-8 rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition-all"
        >
          {t('color_restablecer')}
        </button>
      </div>
    </div>,
    document.body
  );
}
