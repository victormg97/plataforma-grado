'use client';

import { useRef, type ReactNode } from 'react';
import { XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { useEscapeGuard } from './useEscapeGuard';

interface SeguimientoOverlayProps {
  open: boolean;
  onClose: () => void;
  /** Translated accessible name of the overlay. */
  ariaLabel: string;
  /** Translated accessible name of the close button. */
  closeLabel: string;
  /**
   * True while the content has a layer of its own open (confirmation, subset
   * view, detail panel). Escape is then left to that layer.
   */
  ownLayerOpen?: boolean;
  /**
   * When true, a click outside the popup never closes the overlay (used by the assign wizard,
   * so a stray click cannot discard the progress). Default false.
   */
  blockOutsidePress?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Modal shell shared by the tracking reviewer, the subset editor and the
 * assignment dialog. It stacks above the screen modal (z-50) and the class
 * card (z-[60]) without closing or touching them. Full screen below `sm`.
 */
export function SeguimientoOverlay({
  open,
  onClose,
  ariaLabel,
  closeLabel,
  ownLayerOpen = false,
  blockOutsidePress = false,
  className,
  children,
}: SeguimientoOverlayProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  useEscapeGuard({
    enabled: open,
    popupRef,
    ownLayerOpen,
    onEscape: onClose,
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen, eventDetails) => {
        if (nextOpen) return;
        // Escape is handled by useEscapeGuard so lower modals never see it.
        if (eventDetails.reason === 'escape-key') {
          eventDetails.cancel();
          return;
        }
        if (blockOutsidePress && eventDetails.reason === 'outside-press') {
          eventDetails.cancel();
          return;
        }
        onClose();
      }}
    >
      <DialogContent
        ref={popupRef}
        aria-label={ariaLabel}
        showCloseButton={false}
        className={cn(
          'z-[70] flex flex-col gap-0 overflow-hidden p-0',
          'bg-[var(--color-bg)] text-[var(--color-text-primary)]',
          // Full screen below sm
          'top-0 left-0 h-dvh w-full max-w-none translate-x-0 translate-y-0 rounded-none',
          // Centered modal from sm up
          'sm:top-1/2 sm:left-1/2 sm:h-[90dvh] sm:max-w-5xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl',
          className
        )}
      >
        {children}
        <DialogClose
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-2 right-2"
              aria-label={closeLabel}
            />
          }
        >
          <XIcon aria-hidden="true" />
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
