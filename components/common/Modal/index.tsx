'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { XIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  preventOutsideClose?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  preventOutsideClose = false,
}: ModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !preventOutsideClose) onClose();
      }}
    >
      <DialogContent
        className="max-w-lg flex flex-col max-h-[90dvh] overflow-hidden border-[var(--color-border)] bg-[var(--color-bg)]"
        showCloseButton={!preventOutsideClose}
      >
        {preventOutsideClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label="Cerrar"
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}
        <DialogHeader>
          <DialogTitle className="font-[var(--font-display)] text-[var(--color-text-primary)]">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-[var(--color-text-muted)]">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto py-4">{children}</div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
