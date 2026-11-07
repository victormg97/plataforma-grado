'use client';

/**
 * Confirmation dialog shown before removing materias that hold progress data from the subset.
 * It says how many of them have data and that the data is kept as archived (restorable).
 * The dialog does not run the action: the parent decides what happens on confirm.
 */

import { useTranslations } from 'next-intl';
import { ConfirmModal } from '@/components/common/ConfirmModal';

interface ConfirmarQuitarDialogProps {
  open: boolean;
  /** Called on cancel, backdrop or Escape. Ignored while `loading` is true. */
  onClose: () => void;
  onConfirm: () => void;
  /** Number of materias to remove that hold progress data. */
  conAvance: number;
  loading?: boolean;
}

export function ConfirmarQuitarDialog({
  open,
  onClose,
  onConfirm,
  conAvance,
  loading = false,
}: ConfirmarQuitarDialogProps) {
  const t = useTranslations('cedularios.seguimiento.subconjunto');

  const handleClose = () => {
    // Do not close while the action runs, so the result is not lost
    if (loading) return;
    onClose();
  };

  return (
    <ConfirmModal
      open={open}
      onClose={handleClose}
      onConfirm={onConfirm}
      title={t('confirmar_titulo')}
      description={t('confirmar_descripcion', { count: conAvance })}
      confirmText={loading ? t('guardando') : t('confirmar')}
      cancelText={t('cancelar')}
      loading={loading}
      isDanger
    />
  );
}
