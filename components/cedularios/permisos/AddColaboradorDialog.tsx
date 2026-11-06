'use client';

import { useId, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { AppSelect } from '@/components/common/AppSelect';
import { useOtorgarPermiso, useProfesoresDisponibles } from '../hooks/usePermisos';
import { useCedulariosAction } from '../hooks/useCedulariosAction';

export interface AddColaboradorDialogProps {
  cedularioId: string;
  open: boolean;
  onClose: () => void;
}

/**
 * Dialog to grant edit permission to a profesor (Req 6.2, 6.3, 6.4, 6.5, 6.7, 6.12).
 * The list of available profesores loads only while the dialog is open. When the action fails the
 * dialog stays open, the selection is preserved and the translated error is shown inline.
 */
export function AddColaboradorDialog({ cedularioId, open, onClose }: AddColaboradorDialogProps) {
  const t = useTranslations('cedularios');
  const { translateError } = useCedulariosAction();
  const selectId = useId();

  const [profesorId, setProfesorId] = useState('');
  const [errorMensaje, setErrorMensaje] = useState<string | null>(null);

  const disponibles = useProfesoresDisponibles(cedularioId, { enabled: open });
  const otorgar = useOtorgarPermiso({ skipErrorToast: true });

  const opciones = useMemo(
    () =>
      (disponibles.data ?? []).map((p) => ({
        value: p.id,
        label: `${p.nombre} ${p.apellido}`.trim(),
      })),
    [disponibles.data],
  );

  const cargando = disponibles.isPending && disponibles.fetchStatus !== 'idle';
  const sinDisponibles = disponibles.isSuccess && opciones.length === 0;
  const errorCarga = disponibles.isError ? translateError({ code: disponibles.error.code }) : null;
  const enviando = otorgar.isPending;

  const handleClose = () => {
    if (enviando) return;
    setProfesorId('');
    setErrorMensaje(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (!profesorId || enviando) return;
    setErrorMensaje(null);
    const resultado = await otorgar.mutateAsync({ cedularioId, profesorId });
    if (resultado.ok) {
      setProfesorId('');
      onClose();
      return;
    }
    // Keep the dialog open and the selection untouched.
    setErrorMensaje(translateError(resultado.error));
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={t('permisos.dialogo_agregar.titulo')}
      description={t('permisos.dialogo_agregar.descripcion')}
      footer={
        <div className="flex w-full justify-end gap-3">
          <Button variant="ghost" onClick={handleClose} disabled={enviando}>
            {t('comun.cancelar')}
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleConfirm()}
            loading={enviando}
            disabled={!profesorId || sinDisponibles}
          >
            {t('permisos.dialogo_agregar.confirmar')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {cargando && (
          <p className="text-sm text-[var(--color-text-muted)]" role="status">
            {t('comun.cargando')}
          </p>
        )}

        {errorCarga && (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-[var(--color-error)]" role="alert">
              {errorCarga}
            </p>
            <Button variant="secondary" size="sm" onClick={() => void disponibles.refetch()}>
              {t('comun.reintentar')}
            </Button>
          </div>
        )}

        {sinDisponibles && (
          <p className="text-sm text-[var(--color-text-muted)]">
            {t('permisos.dialogo_agregar.sin_disponibles')}
          </p>
        )}

        {opciones.length > 0 && (
          <div className="space-y-2">
            <label
              htmlFor={selectId}
              className="text-sm font-medium text-[var(--color-text-secondary)]"
            >
              {t('permisos.dialogo_agregar.profesor')}
            </label>
            <AppSelect
              id={selectId}
              value={profesorId}
              onChange={(valor) => {
                setProfesorId(valor);
                setErrorMensaje(null);
              }}
              options={opciones}
              placeholder={t('permisos.dialogo_agregar.placeholder')}
              className="w-full"
              disabled={enviando}
            />
          </div>
        )}

        {errorMensaje && (
          <p className="text-sm text-[var(--color-error)]" role="alert">
            {errorMensaje}
          </p>
        )}
      </div>
    </Modal>
  );
}
