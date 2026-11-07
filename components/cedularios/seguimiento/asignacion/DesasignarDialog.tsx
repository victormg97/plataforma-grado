'use client';

/**
 * Confirmation dialog to unassign a cedulario from a student.
 * Shows the cedulario name, the student name and the number of covered subjects, with a
 * confirm and a cancel action. Cancel only closes the dialog and changes nothing.
 * The progress of the assignment is kept (it can be reassigned later), so the dialog says so.
 * On a failed action the dialog stays open (the hook already showed the error toast).
 */

import { useTranslations } from 'next-intl';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { useDesasignarCedulario } from '../hooks/useDesasignarCedulario';

interface DesasignarDialogProps {
  open: boolean;
  /** Called when the dialog must close (cancel, backdrop, Escape or after a success). */
  onClose: () => void;
  asignacionId: string;
  /** Student of the assignment. Only narrows the cache invalidation. */
  alumnoId?: string;
  /** Cedulario of the assignment. Only narrows the cache invalidation. */
  cedularioId?: string;
  cedularioNombre: string;
  alumnoNombre: string;
  /** Number of subjects already covered by the student in this assignment. */
  materiasCubiertas: number;
  /** Called after the assignment was unassigned (or was already unassigned). */
  onDesasignado?: () => void;
}

export function DesasignarDialog({
  open,
  onClose,
  asignacionId,
  alumnoId,
  cedularioId,
  cedularioNombre,
  alumnoNombre,
  materiasCubiertas,
  onDesasignado,
}: DesasignarDialogProps) {
  const t = useTranslations('cedularios.seguimiento.desasignar');
  const mutation = useDesasignarCedulario();
  const loading = mutation.isPending;

  const descripcion = `${t('descripcion', {
    cedulario: cedularioNombre,
    alumno: alumnoNombre,
    cubiertas: materiasCubiertas,
  })} ${t('aviso_conserva')}`;

  const handleClose = () => {
    // Do not close while the action runs, so the result is not lost
    if (loading) return;
    onClose();
  };

  const handleConfirm = () => {
    if (loading) return;
    mutation.mutate(
      { asignacionId, alumnoId, cedularioId },
      {
        onSuccess: (resultado) => {
          if (!resultado.ok) return;
          onDesasignado?.();
          onClose();
        },
      },
    );
  };

  return (
    <ConfirmModal
      open={open}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={t('titulo')}
      description={descripcion}
      confirmText={loading ? t('confirmando') : t('confirmar')}
      cancelText={t('cancelar')}
      loading={loading}
      isDanger
    />
  );
}
