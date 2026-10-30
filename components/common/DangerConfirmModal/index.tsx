'use client';

import { useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { cn } from '@/lib/utils';

interface DangerConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  /**
   * Palabra/frase que el usuario debe escribir EXACTAMENTE para habilitar el
   * botón de confirmación. Protege acciones destructivas de clics accidentales.
   */
  confirmationWord: string;
  /** Etiqueta encima del input, ej. "Escribe ELIMINAR para confirmar". */
  inputLabel: string;
  confirmText: string;
  cancelText: string;
  loading?: boolean;
}

/**
 * Modal de confirmación para acciones IRREVERSIBLES (ej. eliminar cuenta).
 *
 * A diferencia de ConfirmModal, exige que el usuario escriba una palabra exacta
 * antes de poder confirmar. El botón de acción permanece deshabilitado hasta que
 * el texto coincide, evitando borrados accidentales sin volverlo molesto (una
 * sola palabra). El campo se limpia al cerrar.
 */
export function DangerConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmationWord,
  inputLabel,
  confirmText,
  cancelText,
  loading = false,
}: DangerConfirmModalProps) {
  const [value, setValue] = useState('');

  const matches = value.trim() === confirmationWord;

  // Limpia el input al cerrar para no arrastrar texto previo a la próxima apertura.
  function handleClose() {
    if (loading) return;
    setValue('');
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      preventOutsideClose={loading}
      footer={
        <div className="flex w-full justify-end gap-3">
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            loading={loading}
            disabled={!matches || loading}
          >
            {confirmText}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-1">
        <p className="text-sm text-[var(--color-text-secondary)]">{description}</p>

        <div className="space-y-1.5">
          <label
            htmlFor="danger-confirm-input"
            className="block text-sm font-medium text-[var(--color-text-primary)]"
          >
            {inputLabel}
          </label>
          <input
            id="danger-confirm-input"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            disabled={loading}
            className={cn(
              'w-full rounded-[var(--radius-md)] border bg-[var(--color-bg)] px-3 py-2.5 text-sm',
              'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
              'focus:outline-none focus:ring-1 transition-colors',
              matches
                ? 'border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-[var(--color-error)]'
                : 'border-[var(--color-border)] focus:border-[var(--color-brand-gold)] focus:ring-[var(--color-brand-gold)]',
            )}
          />
        </div>
      </div>
    </Modal>
  );
}
