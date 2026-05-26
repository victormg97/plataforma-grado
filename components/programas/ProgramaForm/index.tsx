'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Check, Globe, User, Users, X } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { cn } from '@/lib/utils';
import { programaSchema, type ProgramaFormData } from '@/lib/validations/programa.schema';
import type { ProgramaClase, ProgramaClaseConConteo } from '@/lib/supabase/types';

type ProfesorOption = { id: string; nombre: string; apellido: string };

interface ProgramaFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ProgramaFormData) => Promise<void>;
  programa?: ProgramaClase | ProgramaClaseConConteo | null;
  loading?: boolean;
  isAdmin?: boolean;
  profesores?: ProfesorOption[];
}

type VisMode = 'todos' | 'especifico';

const EMPTY_PROFESORES: ProfesorOption[] = [];

export function ProgramaForm({
  open,
  onClose,
  onSubmit,
  programa,
  loading = false,
  isAdmin = false,
  profesores = EMPTY_PROFESORES,
}: ProgramaFormProps) {
  const t = useTranslations('programas');
  const isEditing = !!programa;

  // Derive initial visibility and selected profs from existing program
  const getInitialVisMode = (): VisMode => {
    if (!programa) return 'todos';
    const p = programa as ProgramaClaseConConteo;
    if (p.visibilidad === 'especifico') return 'especifico';
    return 'todos';
  };

  const getInitialProfIds = (): string[] => {
    if (!programa) return [];
    const p = programa as ProgramaClaseConConteo;
    if (p.profesores_asignados?.length) return p.profesores_asignados.map((pr) => pr.id);
    // fallback: legacy profesor_id
    if (p.profesor_id) return [p.profesor_id];
    return [];
  };

  const [visMode, setVisMode] = useState<VisMode>(getInitialVisMode);
  const [selectedProfIds, setSelectedProfIds] = useState<string[]>(getInitialProfIds);
  const [profSearch, setProfSearch] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProgramaFormData>({
    resolver: zodResolver(programaSchema),
    defaultValues: {
      nombre: programa?.nombre ?? '',
      descripcion: programa?.descripcion ?? '',
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        nombre: programa?.nombre ?? '',
        descripcion: programa?.descripcion ?? '',
      });
      setVisMode(getInitialVisMode());
      setSelectedProfIds(getInitialProfIds());
      setProfSearch('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, programa]);

  const toggleProf = (id: string) => {
    setSelectedProfIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleFormSubmit = async (data: ProgramaFormData) => {
    const payload: ProgramaFormData = {
      ...data,
      visibilidad: isAdmin ? visMode : undefined,
      profesor_ids: isAdmin && visMode === 'especifico' ? selectedProfIds : undefined,
    };
    await onSubmit(payload);
    onClose();
  };

  const filteredProfesores = profesores.filter((p) => {
    const fullName = `${p.nombre} ${p.apellido}`.toLowerCase();
    return fullName.includes(profSearch.toLowerCase());
  });

  const selectedProfesores = profesores.filter((p) => selectedProfIds.includes(p.id));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? t('form.titulo_editar') : t('form.titulo_crear')}
      description={t('form.descripcion_modal')}
      footer={
        <div className="flex w-full items-center justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            {t('form.cancelar')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={loading}
            onClick={handleSubmit(handleFormSubmit)}
          >
            {isEditing ? t('form.guardar') : t('form.crear')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Nombre */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--color-text-primary)]">
            {t('form.nombre')} <span className="text-[var(--color-error)]">*</span>
          </label>
          <input
            {...register('nombre')}
            className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-gold)] focus:ring-2 focus:ring-[var(--color-brand-gold)]/20"
            placeholder={t('form.nombre_placeholder')}
          />
          {errors.nombre && (
            <p className="text-xs text-[var(--color-error)]">{errors.nombre.message}</p>
          )}
        </div>

        {/* Descripcion */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--color-text-primary)]">
            {t('form.descripcion')}
          </label>
          <textarea
            {...register('descripcion')}
            rows={3}
            className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-gold)] focus:ring-2 focus:ring-[var(--color-brand-gold)]/20"
            placeholder={t('form.descripcion_placeholder')}
          />
          {errors.descripcion && (
            <p className="text-xs text-[var(--color-error)]">{errors.descripcion.message}</p>
          )}
        </div>

        {/* Visibilidad — solo admin */}
        {isAdmin && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[var(--color-text-primary)]">
              {t('form.visibilidad_label')}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVisMode('todos')}
                className={cn(
                  'flex flex-1 items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-2 text-sm transition-colors',
                  visMode === 'todos'
                    ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)] text-[var(--color-text-primary)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-brand-gold)]/50 hover:text-[var(--color-text-primary)]'
                )}
              >
                <Globe className="size-4 shrink-0" />
                {t('form.vis_todos')}
              </button>
              <button
                type="button"
                onClick={() => setVisMode('especifico')}
                className={cn(
                  'flex flex-1 items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-2 text-sm transition-colors',
                  visMode === 'especifico'
                    ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)] text-[var(--color-text-primary)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-brand-gold)]/50 hover:text-[var(--color-text-primary)]'
                )}
              >
                <Users className="size-4 shrink-0" />
                {t('form.vis_especifico')}
              </button>
            </div>

            {/* Professor picker */}
            {visMode === 'especifico' && (
              <div className="flex flex-col gap-2">
                {/* Selected chips */}
                {selectedProfesores.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedProfesores.map((p) => (
                      <span
                        key={p.id}
                        className="flex items-center gap-1 rounded-full bg-[var(--color-brand-gold-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-text-primary)]"
                      >
                        <User className="size-3" />
                        {p.nombre} {p.apellido}
                        <button
                          type="button"
                          onClick={() => toggleProf(p.id)}
                          className="ml-0.5 rounded-full hover:text-[var(--color-error)] transition-colors"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Search + list */}
                <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))]">
                  <input
                    type="text"
                    value={profSearch}
                    onChange={(e) => setProfSearch(e.target.value)}
                    placeholder={t('form.buscar_profesor')}
                    className="h-9 w-full border-b border-[var(--color-border)] bg-transparent px-3 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]"
                  />
                  <div className="max-h-36 overflow-y-auto">
                    {filteredProfesores.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-[var(--color-text-muted)]">{t('form.sin_profesores')}</p>
                    ) : (
                      filteredProfesores.map((p) => {
                        const selected = selectedProfIds.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => toggleProf(p.id)}
                            className={cn(
                              'flex w-full items-center justify-between px-3 py-2 text-sm transition-colors',
                              selected
                                ? 'bg-[var(--color-brand-gold-muted)] text-[var(--color-text-primary)]'
                                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
                            )}
                          >
                            <span>{p.nombre} {p.apellido}</span>
                            {selected && <Check className="size-3.5 text-[var(--color-brand-gold)]" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
                {visMode === 'especifico' && selectedProfIds.length === 0 && (
                  <p className="text-xs text-[var(--color-text-muted)]">{t('form.vis_especifico_hint')}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
