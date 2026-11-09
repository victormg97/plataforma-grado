'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Popover } from '@base-ui/react/popover';
import { cn } from '@/lib/utils';

const HOVER_QUERY = '(hover: hover) and (pointer: fine)';
const FOCUS_SUPPRESS_MS = 400;
const TABBABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type OpenOrigin = 'hover' | 'focus' | 'click';

export interface HoverCardProps {
  /** Trigger content. The wrapper renders the trigger element itself. */
  children: ReactNode;
  /**
   * Card content. Mounted only while open. Receives `close` for inner buttons and `lockSide`:
   * call it right before the content changes size to keep the card on the side (top or bottom)
   * where it currently is, instead of letting it flip to the other one. Reset on close.
   */
  content: (api: { close: () => void; lockSide: () => void }) => ReactNode;
  /** Accessible name of both the trigger and the card. */
  ariaLabel: string;
  /** Classes of the trigger element (keeps the layout of the caller). */
  className?: string;
  /** Trigger element. Defaults to 'div'. */
  as?: 'div' | 'span';
  /** Delay before opening on hover. Defaults to 300 ms. */
  openDelayMs?: number;
  /** Delay before closing after the pointer leaves. Defaults to 200 ms. */
  closeDelayMs?: number;
  /** Preferred side of the card relative to the trigger. Defaults to 'bottom'. */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Alignment of the card relative to the trigger. Defaults to 'start'. */
  align?: 'start' | 'center' | 'end';
  /** Called whenever the open state changes. */
  onOpenChange?: (open: boolean) => void;
  /** Extra classes for the card container. */
  contentClassName?: string;
}

function subscribeHover(onChange: () => void) {
  const mq = window.matchMedia(HOVER_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function getHoverSnapshot() {
  return window.matchMedia(HOVER_QUERY).matches;
}

function getHoverServerSnapshot() {
  return false;
}

/** Calls the `content` render function; it only runs while the card is open. */
function CardContent({
  render,
  close,
  lockSide,
}: {
  render: HoverCardProps['content'];
  close: () => void;
  lockSide: () => void;
}) {
  return <>{render({ close, lockSide })}</>;
}

type Side = NonNullable<HoverCardProps['side']>;

function isSide(value: string | null): value is Side {
  return value === 'top' || value === 'bottom' || value === 'left' || value === 'right';
}

function originFromReason(reason: string): OpenOrigin {
  if (reason === 'trigger-hover') return 'hover';
  if (reason === 'trigger-focus') return 'focus';
  return 'click';
}

/**
 * Generic hover card built on the Base UI Popover (controlled `open`).
 *
 * - Hover devices: opens after `openDelayMs` of hover, closes `closeDelayMs`
 *   after the pointer leaves the trigger and the card.
 * - Touch devices: a tap on the trigger opens the card and does not reach the
 *   original action of the trigger. A tap outside closes it.
 * - Keyboard: keyboard focus (`:focus-visible`) opens the card, Enter and Space
 *   open it and stop propagating to clickable containers, Escape closes only
 *   the card and returns the focus to the trigger.
 *
 * It has no knowledge of the domain of its content.
 */
export function HoverCard({
  children,
  content,
  ariaLabel,
  className,
  as = 'div',
  openDelayMs = 300,
  closeDelayMs = 200,
  side = 'bottom',
  align = 'start',
  onOpenChange,
  contentClassName,
}: HoverCardProps) {
  const hasHover = useSyncExternalStore(subscribeHover, getHoverSnapshot, getHoverServerSnapshot);

  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const originRef = useRef<OpenOrigin>('click');
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const suppressFocusUntilRef = useRef(0);
  const positionerRef = useRef<HTMLDivElement | null>(null);
  // Side the card is pinned to once the content asked for it (null = free to flip).
  const [lockedSide, setLockedSide] = useState<Side | null>(null);

  const lockSide = useCallback(() => {
    const current = positionerRef.current?.getAttribute('data-side') ?? null;
    if (isSide(current)) setLockedSide(current);
  }, []);

  const suppressFocusOpen = useCallback(() => {
    suppressFocusUntilRef.current = Date.now() + FOCUS_SUPPRESS_MS;
  }, []);

  const changeOpen = useCallback(
    (next: boolean, origin?: OpenOrigin) => {
      if (next && origin) originRef.current = origin;
      if (openRef.current === next) return;
      openRef.current = next;
      if (!next) setLockedSide(null);
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const close = useCallback(() => changeOpen(false), [changeOpen]);

  // Escape guard. It runs on window in the capture phase so it runs before any
  // document-level listener (for example the one of a Modal below the card).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      event.stopImmediatePropagation();
      changeOpen(false);
      suppressFocusOpen();
      triggerRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, changeOpen, suppressFocusOpen]);

  const TriggerElement = as === 'span' ? <span /> : <div />;

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next, details) => {
        changeOpen(next, next ? originFromReason(details.reason) : undefined);
      }}
    >
      <Popover.Trigger
        ref={triggerRef}
        render={TriggerElement}
        nativeButton={false}
        openOnHover={hasHover}
        delay={openDelayMs}
        closeDelay={closeDelayMs}
        aria-label={ariaLabel}
        className={className}
        onClick={(event) => {
          // Touch: the first tap only opens the card, never the original action.
          // Hover devices: the click keeps reaching the container.
          if (!hasHover) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        onFocus={(event) => {
          if (event.target !== event.currentTarget) return;
          if (openRef.current) return;
          if (Date.now() < suppressFocusUntilRef.current) return;
          let focusVisible = false;
          try {
            focusVisible = event.target.matches(':focus-visible');
          } catch {
            focusVisible = false;
          }
          if (focusVisible) changeOpen(true, 'focus');
        }}
        onBlur={() => {
          if (!openRef.current || originRef.current !== 'focus') return;
          // Wait one frame: Base UI focus guards move the focus into the card.
          window.requestAnimationFrame(() => {
            if (!openRef.current) return;
            const active = document.activeElement;
            const insideTrigger = !!active && !!triggerRef.current?.contains(active);
            const insidePopup = !!active && !!popupRef.current?.contains(active);
            if (!insideTrigger && !insidePopup) changeOpen(false);
          });
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key !== 'Enter' && event.key !== ' ') return;
          // Do not activate clickable containers (role="button" cards).
          event.stopPropagation();
          if (openRef.current) {
            // Already open (hover or focus): move the focus into the card
            // instead of letting the press toggle it closed.
            event.preventBaseUIHandler();
            event.preventDefault();
            const first = popupRef.current?.querySelector<HTMLElement>(TABBABLE_SELECTOR);
            (first ?? popupRef.current)?.focus();
          }
        }}
        onKeyUp={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key !== ' ') return;
          event.stopPropagation();
          if (openRef.current) event.preventBaseUIHandler();
        }}
      >
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          ref={positionerRef}
          side={lockedSide ?? side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          // Pinned: keep the side, only slide along it so the card stays on screen.
          collisionAvoidance={lockedSide ? { side: 'none', align: 'shift', fallbackAxisSide: 'none' } : undefined}
          className="z-[60]"
        >
          <Popover.Popup
            ref={popupRef}
            aria-label={ariaLabel}
            initialFocus={() => originRef.current !== 'hover' && originRef.current !== 'focus'}
            finalFocus={() => {
              suppressFocusOpen();
              return true;
            }}
            className={cn(
              'max-w-[calc(100vw-1rem)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)] shadow-[var(--shadow-lg)] outline-none',
              contentClassName,
            )}
            // The card lives in a portal, but React events still bubble through
            // the React tree to clickable ancestors of the trigger.
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
            }}
          >
            <CardContent render={content} close={close} lockSide={lockSide} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
