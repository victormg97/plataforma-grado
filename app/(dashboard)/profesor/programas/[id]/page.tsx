'use client';

import { useState, use, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Users, Pencil, BookOpen, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Tooltip } from '@/components/common/Tooltip';
import { Modal } from '@/components/common/Modal';
import { ClasesEditor } from '@/components/programas/ClasesEditor';
import { AsignacionWizard } from '@/components/programas/AsignacionWizard';
import { ProgramaForm } from '@/components/programas/ProgramaForm';
import { PruebaCalificacion } from '@/components/programas/PruebaCalificacion';
import {
  usePrograma,
  useActualizarClases,
  useEditarPrograma,
  useAsignarPrograma,
  useDesvincularAlumno,
} from '@/lib/hooks/useProgramas';
import { usePruebas, useCalificarPrueba } from '@/lib/hooks/usePruebas';
import { useUser } from '@/lib/hooks/useUser';
import { useQuery } from '@tanstack/react-query';
import type { AsignacionConAlumno, ClasePrograma, Prueba } from '@/lib/supabase/types';

type ClaseItem = Pick<ClasePrograma, 'id' | 'nombre' | 'tipo' | 'orden'> & {
  descripcion?: string | null;
  duracion_min?: number | null;
  tempId?: string;
};

// Sub-component: renders pruebas for a single alumno within this program
function AlumnoPruebasSection({
  alumnoId,
  programaClaseIds,
  isOwner,
  onCalificar,
  t,
}: {
  alumnoId: string;
  programaClaseIds: Set<string>;
  isOwner: boolean;
  onCalificar: (prueba: Prueba) => void;
  t: (key: string) => string;
}) {
  const { data: pruebas = [] } = usePruebas(alumnoId);
  const alumnosPruebas = pruebas.filter((p: Prueba) => p.clase_id && programaClaseIds.has(p.clase_id));
  if (alumnosPruebas.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 mt-2">
      {alumnosPruebas.map((prueba: Prueba) => (
        <div
          key={prueba.id}
          className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1.5 bg-[var(--color-bg-secondary)]"
        >
          <div>
            <p className="text-xs font-medium text-[var(--color-text-primary)]">{prueba.nombre}</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">{prueba.fecha}</p>
          </div>
          <div className="flex items-center gap-2">
            {prueba.nota !== null && prueba.nota !== undefined ? (
              <span className={`text-sm font-bold ${Number(prueba.nota) >= 4 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                {Number(prueba.nota).toFixed(1)}
              </span>
            ) : (
              <span className="text-xs text-[var(--color-text-muted)]">—</span>
            )}
            {isOwner && (
              <Button variant="ghost" size="sm" onClick={() => onCalificar(prueba)}>
                {t('calificar')}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

async function fetchAlumnos() {
  const res = await fetch('/api/alumnos');
  if (!res.ok) return [];
  return res.json();
}

interface Props {
  params: Promise<{ id: string }>;
}

export default function ProfesorProgramaDetailPage({ params }: Props) {
  const { id } = use(params);
  const t = useTranslations('programas');
  const router = useRouter();
  const { user } = useUser();

  const { data: programa, isLoading, isError } = usePrograma(id);
  const { data: alumnos = [] } = useQuery({ queryKey: ['alumnos'], queryFn: fetchAlumnos });
  const actualizarClases = useActualizarClases();
  const editarPrograma = useEditarPrograma();
  const asignarPrograma = useAsignarPrograma();
  const calificarPrueba = useCalificarPrueba();
  const desvincularAlumno = useDesvincularAlumno();

  const [editFormOpen, setEditFormOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [calificandoPrueba, setCalificandoPrueba] = useState<Prueba | null>(null);
  const [localClases, setLocalClases] = useState<ClaseItem[]>([]);
  const [savedClases, setSavedClases] = useState<ClaseItem[]>([]);

  // Confirmation dialog state for class deletions
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [pendingClases, setPendingClases] = useState<ClaseItem[] | null>(null);
  const [deletedCount, setDeletedCount] = useState(0);

  // Unlink student dialog state
  const [desvinculandoAlumno, setDesvinculandoAlumno] = useState<AsignacionConAlumno | null>(null);

  // Initialize local clases from fetched programa — sync when DB data changes
  const dbClasesStr = JSON.stringify((programa as unknown as { clases_programa: ClaseItem[] })?.clases_programa ?? []);
  useEffect(() => {
    if (programa) {
      const initial = (programa as unknown as { clases_programa: ClaseItem[] }).clases_programa ?? [];
      setLocalClases(initial);
      setSavedClases(initial);
    }
  }, [dbClasesStr, programa]);

  const hasChanges = JSON.stringify(localClases) !== JSON.stringify(savedClases);
  const isOwner = programa?.created_by === user?.id;

  // Count how many DB classes were removed from localClases
  const getRemovedCount = (clases: ClaseItem[]) => {
    const savedIds = new Set(savedClases.filter(c => !!c.id).map(c => c.id));
    const keptIds = new Set(clases.filter(c => !!c.id).map(c => c.id));
    let removed = 0;
    savedIds.forEach(id => { if (!keptIds.has(id)) removed++; });
    return removed;
  };

  const doSaveClases = async (clases: ClaseItem[]) => {
    try {
      await actualizarClases.mutateAsync({ programaId: id, clases });
      toast.success(t('mensajes.clases_guardadas'));
      setConfirmSaveOpen(false);
      setPendingClases(null);
    } catch {
      toast.error(t('mensajes.error_clases'));
    }
  };

  const handleSaveClases = async (clases: ClaseItem[]) => {
    const removed = getRemovedCount(clases);
    if (removed > 0 && hasAsignados) {
      // Show confirmation with affected student details
      setDeletedCount(removed);
      setPendingClases(clases);
      setConfirmSaveOpen(true);
    } else {
      await doSaveClases(clases);
    }
  };

  const handleRevertInModal = () => {
    setLocalClases(savedClases);
    setConfirmSaveOpen(false);
    setPendingClases(null);
  };

  const handleEdit = async (data: { nombre: string; descripcion?: string | null; profesor_id?: string | null }) => {
    try {
      await editarPrograma.mutateAsync({ id, ...data });
      toast.success(t('mensajes.actualizado'));
    } catch {
      toast.error(t('mensajes.error_editar'));
    }
  };

  const handleAsignar = async (
    alumno_ids: string[],
    horarios_por_alumno: Array<{
      alumno_id: string;
      clases: Array<{ clase_id: string; fecha: string; hora_inicio: string; hora_fin: string }>;
    }>
  ) => {
    try {
      const result = await asignarPrograma.mutateAsync({ programaId: id, alumno_ids, horarios_por_alumno });
      toast.success(t('mensajes.asignado', { count: result.asignados }));
    } catch {
      toast.error(t('mensajes.error_asignar'));
    }
  };

  const handleCalificar = async (data: { nota?: number | null; observaciones?: string | null }) => {
    if (!calificandoPrueba) return;
    try {
      await calificarPrueba.mutateAsync({ id: calificandoPrueba.id, ...data });
      toast.success(t('mensajes.calificado'));
    } catch {
      toast.error(t('mensajes.error_calificar'));
    }
  };

  const handleDesvincular = async () => {
    if (!desvinculandoAlumno) return;
    try {
      await desvincularAlumno.mutateAsync({ programaId: id, alumnoId: desvinculandoAlumno.alumno_id });
      toast.success(t('mensajes.desvinculado'));
      setDesvinculandoAlumno(null);
    } catch {
      toast.error(t('mensajes.error_desvincular'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-brand-gold)] border-t-transparent" />
      </div>
    );
  }

  if (isError || !programa) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 rounded-full bg-red-50 p-3 dark:bg-red-900/20">
          <BookOpen className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-[var(--color-text-primary)]">{t('mensajes.error_no_encontrado_titulo')}</h2>
        <p className="mb-6 text-[var(--color-text-muted)]">{t('mensajes.error_no_encontrado_desc')}</p>
        <Button onClick={() => router.push('/profesor/programas')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('volver')}
        </Button>
      </div>
    );
  }

  const programaClaseIds = new Set(localClases.map((c) => c.id));
  const asignaciones = ((programa as unknown as { asignaciones?: AsignacionConAlumno[] }).asignaciones ?? []);
  const hasAsignados = asignaciones.length > 0;

  return (
    <div>
      <div className="mb-2">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('volver')}
        </button>
      </div>

      <PageHeader
        title={programa.nombre}
        subtitle={programa.descripcion ?? t('sin_descripcion')}
        actions={
          <div className="flex items-center gap-2">
            {isOwner && (
              <Tooltip content={t('editar_tooltip')} position="bottom">
                <span>
                  <Button variant="secondary" size="sm" onClick={() => setEditFormOpen(true)}>
                    <Pencil className="mr-1.5 h-4 w-4" />
                    {t('editar')}
                  </Button>
                </span>
              </Tooltip>
            )}
            <Tooltip content={savedClases.length === 0 ? t('asignar_sin_clases') : t('asignar')} position="bottom">
              <span>
                <Button variant="primary" size="sm" onClick={() => setWizardOpen(true)} disabled={hasChanges || savedClases.length === 0}>
                  <Users className="mr-1.5 h-4 w-4" />
                  {t('asignar')}
                </Button>
              </span>
            </Tooltip>
          </div>
        }
      />

      <div className="mt-[var(--space-lg)] flex flex-col gap-6">
        {/* Clases editor */}
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[var(--color-brand-gold)]" />
            <h2 className="font-semibold text-[var(--color-text-primary)]">{t('clases_del_programa')}</h2>
          </div>
          <ClasesEditor
            clases={localClases}
            savedClases={savedClases}
            onChange={setLocalClases}
            readOnly={!isOwner}
            saving={actualizarClases.isPending}
            onSave={isOwner && hasChanges ? handleSaveClases : undefined}
          />
        </Card>

        {/* Alumnos asignados */}
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-[var(--color-brand-gold)]" />
            <h2 className="font-semibold text-[var(--color-text-primary)]">
              {t('n_asignados', { count: asignaciones.length })}
            </h2>
          </div>
          {asignaciones.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--color-text-muted)]">
              {t('wizard.sin_alumnos')}
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {asignaciones.map((asig) => (
                <div key={asig.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-gold)]/10 text-xs font-bold text-[var(--color-brand-gold)]">
                      {asig.alumno?.nombre?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        {asig.alumno?.nombre} {asig.alumno?.apellido}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">{asig.alumno?.email}</p>
                    </div>
                    {isOwner && (
                      <Tooltip content={t('desvincular_tooltip')} position="left">
                        <button
                          type="button"
                          onClick={() => setDesvinculandoAlumno(asig)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[var(--color-text-muted)] hover:bg-red-50 hover:text-[var(--color-error)] dark:hover:bg-red-950/20 transition-colors"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </button>
                      </Tooltip>
                    )}
                  </div>
                  <AlumnoPruebasSection
                    alumnoId={asig.alumno_id}
                    programaClaseIds={programaClaseIds}
                    isOwner={isOwner}
                    onCalificar={setCalificandoPrueba}
                    t={t}
                  />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Confirmation modal for class deletions */}
      <Modal
        open={confirmSaveOpen}
        onClose={() => setConfirmSaveOpen(false)}
        title={t('eliminar_clases_modal.titulo')}
        preventOutsideClose
        footer={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmSaveOpen(false)} disabled={actualizarClases.isPending}>
              {t('eliminar_clases_modal.cancelar')}
            </Button>
            <Button variant="secondary" onClick={handleRevertInModal} disabled={actualizarClases.isPending}>
              {t('eliminar_clases_modal.revertir')}
            </Button>
            <Button
              variant="danger"
              onClick={() => pendingClases && doSaveClases(pendingClases)}
              loading={actualizarClases.isPending}
            >
              {t('eliminar_clases_modal.confirmar')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t('eliminar_clases_modal.descripcion', { count: deletedCount })}
          </p>
          <ul className="flex flex-col gap-1.5">
            {asignaciones.map((asig) => (
              <li key={asig.id} className="flex items-center gap-2 text-sm">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand-gold)]" />
                <span className="font-medium text-[var(--color-text-primary)]">
                  {asig.alumno?.nombre} {asig.alumno?.apellido}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-1 rounded-[var(--radius-sm)] bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 px-3 py-2">
            <p className="text-xs text-amber-800 dark:text-amber-300">
              ⚠ {t('eliminar_clases_modal.advertencia')}
            </p>
          </div>
        </div>
      </Modal>

      {/* Unlink student modal */}
      <Modal
        open={!!desvinculandoAlumno}
        onClose={() => setDesvinculandoAlumno(null)}
        title={t('desvincular_modal.titulo')}
        footer={
          <div className="flex w-full justify-end gap-3">
            <Button variant="ghost" onClick={() => setDesvinculandoAlumno(null)} disabled={desvincularAlumno.isPending}>
              {t('desvincular_modal.cancelar')}
            </Button>
            <Button variant="danger" onClick={handleDesvincular} loading={desvincularAlumno.isPending}>
              {t('desvincular_modal.confirmar')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-[var(--color-text-secondary)]">
          {t('desvincular_modal.descripcion', {
            nombre: `${desvinculandoAlumno?.alumno?.nombre ?? ''} ${desvinculandoAlumno?.alumno?.apellido ?? ''}`.trim(),
          })}
        </p>
      </Modal>

      {/* Modals */}
      <ProgramaForm
        open={editFormOpen}
        onClose={() => setEditFormOpen(false)}
        onSubmit={handleEdit}
        programa={programa as unknown as import('@/lib/supabase/types').ProgramaClase}
        loading={editarPrograma.isPending}
      />

      <AsignacionWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onConfirm={handleAsignar}
        alumnos={alumnos}
        clases={localClases}
        loading={asignarPrograma.isPending}
      />

      <PruebaCalificacion
        open={!!calificandoPrueba}
        onClose={() => setCalificandoPrueba(null)}
        onSubmit={handleCalificar}
        prueba={calificandoPrueba}
        loading={calificarPrueba.isPending}
      />
    </div>
  );
}
