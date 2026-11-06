'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { cedulariosKeys } from '@/lib/cedularios/keys';
import type { Universidad } from '@/lib/queries/cedularios/universidades';
import { useCedulariosAction } from '../hooks/useCedulariosAction';
import { useEliminarUniversidad } from '../hooks/useUniversidades';

interface EliminarUniversidadDialogProps {
  universidad: Universidad;
  onClose: () => void;
}

/**
 * Confirmation dialog to soft-delete a universidad (Requirements 1.8, 1.9, 1.10). The dialog is open
 * while it is mounted. When the server rejects the deletion because of active cedularios, the dialog
 * stays open and shows the blocking count; any other failure shows the usual error toast.
 */
export function EliminarUniversidadDialog({ universidad, onClose }: EliminarUniversidadDialogProps) {
  const t = useTranslations('cedularios');
  const qc = useQueryClient();
  const { translateError, showError } = useCedulariosAction();
  const eliminar = useEliminarUniversidad({ skipErrorToast: true });
  const [mensajeBloqueo, setMensajeBloqueo] = useState<string | null>(null);

  const cerrar = () => {
    if (!eliminar.isPending) onClose();
  };

  const confirmar = async () => {
    setMensajeBloqueo(null);
    const resultado = await eliminar.mutateAsync(universidad.id);
    if (resultado.ok) {
      onClose();
      return;
    }
    if (resultado.error.code === 'universidad_con_cedularios') {
      setMensajeBloqueo(translateError(resultado.error));
      // The cedularios list was stale: refresh it so the card counts match.
      void qc.invalidateQueries({ queryKey: cedulariosKeys.lista() });
      return;
    }
    showError(resultado.error);
  };

  return (
    <Modal
      open
      onClose={cerrar}
      title={t('dialogos.eliminar_universidad.titulo')}
      footer={
        <div className="flex w-full justify-end gap-3">
          <Button type="button" variant="ghost" onClick={cerrar} disabled={eliminar.isPending}>
            {t('comun.cancelar')}
          </Button>
          <Button type="button" variant="danger" onClick={confirmar} loading={eliminar.isPending}>
            {eliminar.isPending ? t('comun.eliminando') : t('dialogos.eliminar_universidad.confirmar')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 py-2">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {t('dialogos.eliminar_universidad.descripcion', { nombre: universidad.nombre })}
        </p>
        {mensajeBloqueo !== null && (
          <p
            role="alert"
            className="rounded-[var(--radius-sm)] border border-[var(--color-error)] px-3 py-2 text-sm text-[var(--color-error)]"
          >
            {mensajeBloqueo}
          </p>
        )}
      </div>
    </Modal>
  );
}
