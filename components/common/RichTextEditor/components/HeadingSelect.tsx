'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HeadingOption {
  value: string;
  label: string;
  className: string;
}

interface HeadingSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: HeadingOption[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HeadingSelect({ value, onChange, options }: HeadingSelectProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []); // eslint-disable-line react-hooks/set-state-in-effect

  const selected = options.find((o) => o.value === value);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropUp = spaceBelow < 220 && spaceAbove > spaceBelow;

    setDropdownStyle({
      position: 'fixed',
      left: rect.left,
      width: Math.max(rect.width, 160),
      zIndex: 99990,
      ...(dropUp
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  };

  const openDropdown = () => {
    updatePosition();
    setOpen(true);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !listRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Reposition on scroll
  useEffect(() => {
    if (!open) return;
    const reposition = () => updatePosition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dropdown = open && mounted && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={listRef}
          style={dropdownStyle}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] shadow-[var(--shadow-lg)] ring-1 ring-[var(--color-brand-gold)]/20 overflow-hidden max-h-[240px] overflow-y-auto"
          role="listbox"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(opt.value);
                setOpen(false);
              }}
              className={`flex w-full items-center px-3 py-2 text-left transition-colors
                ${opt.value === value
                  ? 'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]'
                  : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]'
                }`}
            >
              <span className={opt.className}>{opt.label}</span>
              {opt.value === value && (
                <span className="ml-auto text-[var(--color-brand-gold)] text-xs">✓</span>
              )}
            </button>
          ))}
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          open ? setOpen(false) : openDropdown();
        }}
        className={`flex items-center justify-between gap-1 h-8 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] pl-2 pr-1.5 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors min-w-[100px] ${
          open ? 'border-[var(--color-brand-gold)] ring-1 ring-[var(--color-brand-gold)]/30' : ''
        }`}
      >
        <span className="truncate">{selected?.label ?? ''}</span>
        <ChevronDown
          className={`size-3 shrink-0 text-[var(--color-text-muted)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {dropdown}
    </>
  );
}
