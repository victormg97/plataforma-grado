'use client';

import { useState, use, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Users, Pencil, BookOpen, UserMinus, Globe, User } from 'lucide-react';
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
import { useQuery } from '@tanstack/react-query';
import type { AsignacionConAlumno, ClaseItem, Prueba, ProgramaClaseConConteo } from '@/lib/supabase/types';
import type { ProgramaFormData } from '@/lib/validations/programa.schema';

async function fetchAlumnos() {
  const res = await fetch('/api/alumnos');
  if (!res.ok) return [];
  return res.json();
}

async function fetchProfesores() {
  const res = await fetch('/api/admin/profesores');
  if (!res.ok) return [];
  const data = await res.json();
  return (data as { id: string; nombre: string; apellido: string; rol: string }[]).filter(
    (p) => p.rol === 'profesor'
  );
}

interface Props {
  params: Promise<{ id: string }>;
}

export default function AdminProgramaDetailPage({ params }: Props) {
  const { id } = use(params);
  const t = useTranslations('programas');
  const router = useRouter();

  const { data: programa, isLoading, isError } = usePrograma(id);
  const { data: alumnos = [] } = useQuery({ queryKey: ['alumnos'], queryFn: fetchAlumnos });
  const { data: profesores = [] } = useQuery({ queryKey: ['profesores'], queryFn: fetchProfesores });
  const { data: pruebas = [] } = usePruebas();

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

  const dbClasesStr = JSON.stringify((programa as unknown as { clases_programa: ClaseItem[] })?.clases_programa ?? []);
  useEffect(() => {
    if (programa) {
      const initial = (programa as unknown as { clases_programa: ClaseItem[] }).clases_programa ?? [];
      setLocalClases(initial);
      setSavedClases(initial);
    }
  }, [dbClasesStr, programa]);

  const hasChanges = JSON.stringify(localClases) !== JSON.stringify(savedClases);

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

  const handleEdit = async (data: ProgramaFormData) => {
    try {
      await editarPrograma.mutateAsync({ id, ...data });
      toast.success(t('mensajes.actualizado'));
      setEditFormOpen(false);
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
        <Button onClick={() => router.push('/admin/programas')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('volver')}
        </Button>
      </div>
    );
  }

  const programaClaseIds = new Set(localClases.map((c) => c.id));
  const asignaciones = ((programa as unknown as { asignaciones?: AsignacionConAlumno[] }).asignaciones ?? []);
  const hasAsignados = asignaciones.length > 0;
  const programasPruebas = pruebas.filter((p: Prueba) => p.clase_id && programaClaseIds.has(p.clase_id));

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
            <Button variant="secondary" size="sm" onClick={() => setEditFormOpen(true)}>
              <Pencil className="mr-1.5 h-4 w-4" />
              {t('editar')}
            </Button>
            <Tooltip content={t('asignar')} position="bottom">
              <span>
                <Button variant="primary" size="sm" onClick={() => setWizardOpen(true)} disabled={hasChanges}>
                  <Users className="mr-1.5 h-4 w-4" />
                  {t('asignar')}
                </Button>
              </span>
            </Tooltip>
          </div>
        }
      />

      <div className="mt-[var(--space-lg)] flex flex-col gap-6">
        {/* Visibility info — admin only */}
        {(() => {
          const p = programa as unknown as ProgramaClaseConConteo;
          const vis = p.visibilidad ?? 'todos';
          const profs = p.profesores_asignados ?? [];
          // Fall back to creator if junction data is missing
          const creator = p.creado_por;
          const displayProfs =
            profs.length > 0
              ? profs
              : creator
              ? [{ id: creator.id, nombre: creator.nombre, apellido: creator.apellido }]
              : [];
          return (
            <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-muted)]">
              {vis === 'todos' ? (
                <>
                  <Globe className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                  <span>{t('form.vis_todos')}</span>
                </>
              ) : displayProfs.length === 1 ? (
                <>
                  <User className="h-4 w-4 shrink-0 text-[var(--color-brand-gold)]" />
                  <span className="text-[var(--color-text-primary)]">{displayProfs[0].nombre} {displayProfs[0].apellido}</span>
                </>
              ) : displayProfs.length > 1 ? (
                <>
                  <Users className="h-4 w-4 shrink-0 text-[var(--color-brand-gold)]" />
                  <span className="text-[var(--color-text-primary)]">{displayProfs.map((pr) => `${pr.nombre} ${pr.apellido}`).join(', ')}</span>
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                  <span>{t('form.vis_todos')}</span>
                </>
              )}
            </div>
          );
        })()}

        <Card>
          <div className="mb-4 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[var(--color-brand-gold)]" />
            <h2 className="font-semibold text-[var(--color-text-primary)]">{t('clases_del_programa')}</h2>
          </div>
          <ClasesEditor
            clases={localClases}
            savedClases={savedClases}
            onChange={setLocalClases}
            readOnly={false}
            saving={actualizarClases.isPending}
            onSave={handleSaveClases}
          />
        </Card>

        {/* Alumnos asignados */}
        {asignaciones.length > 0 && (
          <Card>
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-[var(--color-brand-gold)]" />
              <h2 className="font-semibold text-[var(--color-text-primary)]">
                {t('n_asignados', { count: asignaciones.length })}
              </h2>
            </div>
            <div className="flex flex-col gap-4">
              {asignaciones.map((asig) => (
                <div key={asig.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-gold)]/10 text-xs font-bold text-[var(--color-brand-gold)]">
                      {asig.alumno?.nombre?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                        {asig.alumno?.nombre} {asig.alumno?.apellido}
                      </p>
                      <p className="truncate text-xs text-[var(--color-text-muted)]">{asig.alumno?.email}</p>
                    </div>
                    <Tooltip content={t('desvincular_tooltip')} position="left">
                      <button
                        type="button"
                        onClick={() => setDesvinculandoAlumno(asig)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[var(--color-text-muted)] hover:bg-red-50 hover:text-[var(--color-error)] dark:hover:bg-red-950/20 transition-colors"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {programasPruebas.length > 0 && (
          <Card>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="font-semibold text-[var(--color-text-primary)]">{t('pruebas')}</h2>
              <span className="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                {programasPruebas.length}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {programasPruebas.map((prueba: Prueba) => (
                <div
                  key={prueba.id}
                  className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{prueba.nombre}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{prueba.fecha} · {prueba.estado}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {prueba.nota !== null && (
                      <span className="text-lg font-bold text-[var(--color-brand-gold)]">
                        {Number(prueba.nota).toFixed(1)}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCalificandoPrueba(prueba)}
                    >
                      {t('calificar')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
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

      <ProgramaForm
        open={editFormOpen}
        onClose={() => setEditFormOpen(false)}
        onSubmit={handleEdit}
        programa={programa as unknown as ProgramaClaseConConteo}
        loading={editarPrograma.isPending}
        isAdmin
        profesores={profesores}
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
