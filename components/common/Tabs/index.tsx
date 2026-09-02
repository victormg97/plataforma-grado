'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';
import type { KeyboardEvent, ReactNode } from 'react';

export interface TabItem {
  key: string;
  label: string;
  icon?: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
  /** Prefix for the generated tab/tabpanel ids (default 'tab'). */
  idPrefix?: string;
  'aria-label'?: string;
}

/** id helpers shared with the tab panels so aria-controls/labelledby line up. */
export function tabId(prefix: string, key: string) {
  return `${prefix}-tab-${key}`;
}
export function tabPanelId(prefix: string, key: string) {
  return `${prefix}-panel-${key}`;
}

/**
 * Accessible tab bar (role="tablist") with roving tabindex + arrow-key
 * navigation (WAI-ARIA tabs pattern). Underline style matching the platform
 * admin sections (border-b-2 + --color-brand-gold). Horizontally scrollable
 * on narrow screens. Pair each panel with role="tabpanel", id={tabPanelId(...)}
 * and aria-labelledby={tabId(...)}.
 */
export function Tabs({ items, active, onChange, className, idPrefix = 'tab', ...rest }: TabsProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = items.findIndex((i) => i.key === active);
    if (currentIndex < 0) return;

    let nextIndex: number | null = null;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (currentIndex + 1) % items.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (currentIndex - 1 + items.length) % items.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = items.length - 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    const nextKey = items[nextIndex].key;
    onChange(nextKey);
    refs.current[nextKey]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={rest['aria-label']}
      aria-orientation="horizontal"
      className={cn(
        'flex gap-1 overflow-x-auto border-b border-[var(--color-border)]',
        className
      )}
    >
      {items.map((item) => {
        const isActive = active === item.key;
        return (
          <button
            key={item.key}
            ref={(el) => {
              refs.current[item.key] = el;
            }}
            id={tabId(idPrefix, item.key)}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-controls={tabPanelId(idPrefix, item.key)}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(item.key)}
            onKeyDown={onKeyDown}
            className={cn(
              'inline-flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap border-b-2 -mb-px px-4 pb-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]',
              isActive
                ? 'border-[var(--color-brand-gold)] text-[var(--color-brand-gold)]'
                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            )}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
