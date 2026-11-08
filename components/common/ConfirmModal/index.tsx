'use client';

import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  isDanger?: boolean;
  /** Extra classes for the popup (for example a higher z-index above the tracking overlay). */
  contentClassName?: string;
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  loading = false,
  isDanger = true,
  contentClassName,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      contentClassName={contentClassName}
      footer={
        <div className="flex w-full justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={isDanger ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmText}
          </Button>
        </div>
      }
    >
      <div className="py-2">
        <p className="text-sm text-[var(--color-text-secondary)]">{description}</p>
      </div>
    </Modal>
  );
}
