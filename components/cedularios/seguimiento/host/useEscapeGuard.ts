'use client';

import { useEffect, useRef, type RefObject } from 'react';

/** Input types that hold free text. */
const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password']);

/**
 * True when the event target is a text field with a non-empty value. Such a field
 * clears its own text on the first Escape (search box), so the guard stays out
 * and the next Escape, with the field empty, closes the overlay.
 */
function isNonEmptyTextField(target: EventTarget | null): boolean {
  if (target instanceof HTMLTextAreaElement) return target.value !== '';
  if (target instanceof HTMLInputElement) {
    return TEXT_INPUT_TYPES.has(target.type) && target.value !== '';
  }
  return false;
}

interface UseEscapeGuardOptions {
  /** The guard only listens while the overlay is open. */
  enabled: boolean;
  /** Popup element of the overlay. Only Escape events born inside it are handled. */
  popupRef: RefObject<HTMLElement | null>;
  /**
   * True while the overlay has a layer of its own open (confirmation, subset
   * view, detail panel). The guard then stays out and the layer handles its
   * own Escape.
   */
  ownLayerOpen: boolean;
  /** Closes the innermost level, which is the overlay itself when no layer is open. */
  onEscape: () => void;
}

/**
 * Capture-phase Escape guard for the tracking overlay.
 *
 * When Escape is pressed inside the overlay popup and no own layer is open, it
 * stops the event before it reaches modals underneath (screen modal, class
 * card) and closes only the overlay. Child ConfirmModals are rendered in their
 * own portal, so their events do not originate inside the popup and keep
 * handling their own Escape. A text field with text inside keeps its Escape
 * for clearing itself first.
 */
export function useEscapeGuard({
  enabled,
  popupRef,
  ownLayerOpen,
  onEscape,
}: UseEscapeGuardOptions): void {
  // Latest values live in refs so the listener is attached once per open state.
  const ownLayerOpenRef = useRef(ownLayerOpen);
  const onEscapeRef = useRef(onEscape);

  useEffect(() => {
    ownLayerOpenRef.current = ownLayerOpen;
    onEscapeRef.current = onEscape;
  }, [ownLayerOpen, onEscape]);

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.isComposing) return;
      if (ownLayerOpenRef.current) return;

      const popup = popupRef.current;
      const target = event.target;
      if (!popup || !(target instanceof Node) || !popup.contains(target)) return;
      if (isNonEmptyTextField(target)) return;

      event.stopPropagation();
      onEscapeRef.current();
    }

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [enabled, popupRef]);
}
