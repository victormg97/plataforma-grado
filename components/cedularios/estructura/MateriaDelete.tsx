'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import { descendientes, type MateriaNodo } from '@/lib/cedularios/tree';
import { useCedulariosUrl } from '../hooks/CedulariosUrlContext';
import { useEliminarMateria, useMateriasTree, useRestaurarMaterias } from '../hooks/useMaterias';

/** How long the undo toast stays on screen (Requirement 12.11). */
export const DESHACER_DURACION_MS = 5000;

const SIN_MATERIAS: MateriaNodo[] = [];

interface DeleteMateriaDialogProps {
  nombre: string;
  /** Active descendants that will be deleted too. */
  descendientes: number;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation of a materia deletion that has active descendants (Requirement 12.9). It is open
 * while it is mounted. Prefer `useEliminarMateriaFlujo`, which decides when to show it.
 */
export function DeleteMateriaDialog({ nombre, descendientes, loading, onConfirm, onCancel }: DeleteMateriaDialogProps) {
  const t = useTranslations('cedularios');
  return (
    <ConfirmModal
      open
      onClose={() => {
        if (!loading) onCancel();
      }}
      onConfirm={onConfirm}
      title={t('dialogos.eliminar_materia.titulo')}
      description={t('dialogos.eliminar_materia.descripcion', { count: descendientes, nombre })}
      confirmText={loading ? t('comun.eliminando') : t('dialogos.eliminar_materia.confirmar')}
      cancelText={t('comun.cancelar')}
      loading={loading}
    />
  );
}

interface ConfirmacionPendiente {
  id: string;
  nombre: string;
  descendientes: number;
}

export interface EliminarMateriaFlujo {
  /**
   * Call it when the user asks to delete a materia:
   * - no ACTIVE descendants: it is deleted at once, with no dialog;
   * - one or more: `dialogo` asks for confirmation and the deletion happens only after confirming.
   * After a successful deletion an undo toast (5 s) appears in both cases.
   */
  solicitarEliminar: (id: string) => void;
  /** A deletion request is in flight. */
  eliminando: boolean;
  /** Render it once, anywhere in the host component. `null` when no confirmation is needed. */
  dialogo: ReactNode;
}

/**
 * Delete flow of a materia (Requirements 4.15, 4.16, 12.8 to 12.11, 12.13, 15.1).
 *
 * The count of active descendants comes from the flat structure list, so the decision to show the
 * dialog needs no request. `eliminarMateria` returns the ids it deactivated (the materia and its
 * active descendants); the Undo button of the toast sends them to `restaurarMaterias`.
 *
 * Undo is all or nothing. `restaurar_materias` is one plpgsql function, so it runs in a single
 * transaction: if reactivating any row fails (for example a new sibling took the código and
 * `uq_materias_codigo_hermanos` raises `23505`), every change of the call is rolled back and all
 * the materias stay deleted. The error is shown as `errores.codigo_duplicado_nivel`.
 *
 * The undo window lives in the toast only: it ends after 5 s or when the page reloads, and nothing
 * is persisted. When the open materia (`ced_materia`) is among the deleted ones, the panel closes.
 */
export function useEliminarMateriaFlujo(cedularioId: string): EliminarMateriaFlujo {
  const t = useTranslations('cedularios');
  const { data } = useMateriasTree(cedularioId);
  const flat = data ?? SIN_MATERIAS;
  const { materiaId, clearMateria } = useCedulariosUrl();
  // Success and error toasts of the deletion: the undo toast replaces the success one.
  const eliminar = useEliminarMateria({ skipSuccessToast: true });
  // Default toasts: `materia_restaurada` on success, the translated error otherwise.
  const restaurar = useRestaurarMaterias();
  const [pendiente, setPendiente] = useState<ConfirmacionPendiente | null>(null);
  const [enCurso, setEnCurso] = useState(false);

  // The request resolves later: read the panel state at that moment, not at the click.
  const abiertaRef = useRef<{ materiaId: string | null; cerrar: () => void }>({ materiaId, cerrar: clearMateria });
  useEffect(() => {
    abiertaRef.current = { materiaId, cerrar: clearMateria };
  }, [materiaId, clearMateria]);

  const { mutateAsync: eliminarAsync } = eliminar;
  const { mutateAsync: restaurarAsync } = restaurar;

  const deshacer = useCallback(
    async (ids: string[]) => {
      // Failure (código taken meanwhile, no permission...) shows its toast; the materias stay deleted.
      await restaurarAsync(ids);
    },
    [restaurarAsync],
  );

  const ejecutar = useCallback(
    async (id: string) => {
      setEnCurso(true);
      try {
        const resultado = await eliminarAsync(id);
        if (!resultado.ok) return; // the error toast was shown by the mutation
        const { ids } = resultado.data;
        if (ids.length === 0) return; // already deleted by someone else: nothing to undo

        const abierta = abiertaRef.current;
        if (abierta.materiaId !== null && ids.includes(abierta.materiaId)) abierta.cerrar();

        toast(t('toasts.materia_eliminada', { count: ids.length }), {
          duration: DESHACER_DURACION_MS,
          dismissible: true,
          closeButton: true,
          action: { label: t('toasts.deshacer'), onClick: () => void deshacer(ids) },
        });
      } finally {
        setEnCurso(false);
      }
    },
    [deshacer, eliminarAsync, t],
  );

  const solicitarEliminar = useCallback(
    (id: string) => {
      if (enCurso || pendiente !== null) return;
      const nodo = flat.find((n) => n.id === id && n.activo);
      if (!nodo) return;
      const activos = descendientes(flat, id).filter((n) => n.activo).length;
      if (activos === 0) {
        void ejecutar(id);
      } else {
        setPendiente({ id, nombre: nodo.nombre, descendientes: activos });
      }
    },
    [enCurso, ejecutar, flat, pendiente],
  );

  const confirmar = useCallback(async () => {
    if (pendiente === null) return;
    try {
      await ejecutar(pendiente.id);
    } finally {
      // On failure the error toast was shown and the list was possibly stale: close either way.
      setPendiente(null);
    }
  }, [ejecutar, pendiente]);

  const dialogo =
    pendiente !== null ? (
      <DeleteMateriaDialog
        key={pendiente.id}
        nombre={pendiente.nombre}
        descendientes={pendiente.descendientes}
        loading={enCurso}
        onConfirm={() => void confirmar()}
        onCancel={() => setPendiente(null)}
      />
    ) : null;

  return { solicitarEliminar, eliminando: enCurso, dialogo };
}
