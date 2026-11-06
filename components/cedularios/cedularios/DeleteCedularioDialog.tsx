'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { useCedulariosUrl } from '../hooks/CedulariosUrlContext';
import { useEliminarCedulario } from '../hooks/useCedularios';

interface DeleteCedularioDialogProps {
  nombre: string;
  /** Active materias of the cedulario, shown in the message. */
  materias: number;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation dialog of a cedulario deletion that has active materias (Requirement 2.11). It is
 * open while it is mounted. Prefer `useEliminarCedularioFlujo`, which decides when to show it.
 */
export function DeleteCedularioDialog({ nombre, materias, loading, onConfirm, onCancel }: DeleteCedularioDialogProps) {
  const t = useTranslations('cedularios');
  return (
    <ConfirmModal
      open
      onClose={() => {
        if (!loading) onCancel();
      }}
      onConfirm={onConfirm}
      title={t('dialogos.eliminar_cedulario.titulo')}
      description={t('dialogos.eliminar_cedulario.descripcion', { count: materias, nombre })}
      confirmText={loading ? t('comun.eliminando') : t('dialogos.eliminar_cedulario.confirmar')}
      cancelText={t('comun.cancelar')}
      loading={loading}
    />
  );
}

interface CedularioAEliminar {
  id: string;
  nombre: string;
}

interface ConfirmacionPendiente extends CedularioAEliminar {
  materias: number;
}

export interface EliminarCedularioFlujo {
  /**
   * Call it when the user clicks "Eliminar cedulario". It sends the first request right away:
   * - no active materias: the cedulario is deleted with no dialog (success toast);
   * - active materias: `dialogo` shows the confirmation, and confirming sends the request again
   *   with `confirmado: true`;
   * - assignments or any other failure: error toast, no dialog.
   * When the deleted cedulario is the one open in the URL (`ced_id`), the URL returns to the list.
   */
  solicitarEliminacion: (cedulario: CedularioAEliminar) => Promise<void>;
  /** Id of the cedulario whose first request is in flight (use it for a loading state on the button). */
  evaluandoId: string | null;
  /** Render it once, anywhere in the host component. `null` when no confirmation is needed. */
  dialogo: ReactNode;
}

/** Delete flow of a cedulario (Requirements 2.10, 2.11, 2.12, 2.13). */
export function useEliminarCedularioFlujo(): EliminarCedularioFlujo {
  const { cedularioId, setCedularioId } = useCedulariosUrl();
  const eliminar = useEliminarCedulario();
  const [evaluandoId, setEvaluandoId] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState<ConfirmacionPendiente | null>(null);

  // The request resolves later: read the cedulario open at that moment, not at the click.
  const abiertoRef = useRef<string | null>(cedularioId);
  useEffect(() => {
    abiertoRef.current = cedularioId;
  }, [cedularioId]);

  const alEliminar = useCallback(
    (id: string) => {
      if (abiertoRef.current === id) setCedularioId(null);
    },
    [setCedularioId],
  );

  const { mutateAsync } = eliminar;

  const solicitarEliminacion = useCallback(
    async (cedulario: CedularioAEliminar) => {
      if (evaluandoId !== null || pendiente !== null) return;
      setEvaluandoId(cedulario.id);
      try {
        const resultado = await mutateAsync({ id: cedulario.id });
        if (!resultado.ok) return; // the error toast was shown by the mutation
        if (resultado.data.eliminado) {
          alEliminar(cedulario.id);
        } else {
          setPendiente({ ...cedulario, materias: resultado.data.requiereConfirmacion.materias });
        }
      } finally {
        setEvaluandoId(null);
      }
    },
    [alEliminar, evaluandoId, mutateAsync, pendiente],
  );

  const confirmar = useCallback(async () => {
    if (pendiente === null) return;
    try {
      const resultado = await mutateAsync({ id: pendiente.id, confirmado: true });
      if (resultado.ok && resultado.data.eliminado) alEliminar(pendiente.id);
    } finally {
      // On failure the error toast was shown and the list was possibly stale: close either way.
      setPendiente(null);
    }
  }, [alEliminar, mutateAsync, pendiente]);

  const dialogo =
    pendiente !== null ? (
      <DeleteCedularioDialog
        key={pendiente.id}
        nombre={pendiente.nombre}
        materias={pendiente.materias}
        loading={eliminar.isPending}
        onConfirm={() => void confirmar()}
        onCancel={() => setPendiente(null)}
      />
    ) : null;

  return { solicitarEliminacion, evaluandoId, dialogo };
}
