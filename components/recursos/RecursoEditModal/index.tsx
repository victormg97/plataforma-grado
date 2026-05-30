'use client';

import { useState, useEffect } from 'react';
import { Check, Save, Loader2, Globe, Users, Building2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Modal } from '@/components/common/Modal';
import type { RecursoItem } from '@/components/recursos/RecursoCard';
import type { VisibilidadMode } from '@/components/recursos/RecursoUploader/components/AlumnoAssignmentSelector';

const inputCls =
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:ring-2 focus:ring-[var(--color-brand-gold-muted)] transition-colors';

const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]';

interface Alumno {
  id: string;
  nombre: string;
  apellido: string;
}

interface RecursoEditModalProps {
  recurso: RecursoItem;
  alumnos: Alumno[];
  onClose: () => void;
  onSave: (
    id: string,
    data: { titulo: string; descripcion: string | null; para_todos: boolean; para_todos_app: boolean; alumno_ids: string[]; bloquear_descarga: boolean }
  ) => Promise<void>;
  saving: boolean;
}

// ── Helper: derive VisibilidadMode from resource flags ────────────────────────
function getInitialMode(recurso: RecursoItem): VisibilidadMode {
  if (recurso.para_todos_app) return 'todos_app';
  if (recurso.para_todos)     return 'mis_alumnos';
  return 'especificos';
}

function modeToDbFields(mode: VisibilidadMode): { para_todos: boolean; para_todos_app: boolean } {
  if (mode === 'todos_app')   return { para_todos: false, para_todos_app: true };
  if (mode === 'mis_alumnos') return { para_todos: true,  para_todos_app: false };
  return { para_todos: false, para_todos_app: false };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RecursoEditModal({
  recurso,
  alumnos,
  onClose,
  onSave,
  saving,
}: RecursoEditModalProps) {
  const t = useTranslations('recursos');
  const supabase = createClient();

  const [titulo, setTitulo] = useState(recurso.titulo);
  const [descripcion, setDescripcion] = useState(recurso.descripcion ?? '');
  const [visibilidad, setVisibilidad] = useState<VisibilidadMode>(getInitialMode(recurso));
  const [bloquearDescarga, setBloquearDescarga] = useState(recurso.bloquear_descarga ?? false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [alumnoSearch, setAlumnoSearch] = useState('');

  // Load current acceso records
  const { data: accesoIds, isLoading: loadingAcceso } = useQuery<string[]>({
    queryKey: ['recurso-acceso', recurso.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recursos_acceso')
        .select('alumno_id')
        .eq('recurso_id', recurso.id);
      if (error) throw error;
      return data?.map((r) => r.alumno_id) ?? [];
    },
    staleTime: 0,
    enabled: visibilidad === 'especificos',
  });

  useEffect(() => {
    if (accesoIds) setSelectedIds(accesoIds);
  }, [accesoIds]);

  const filteredAlumnos = alumnos.filter((a) =>
    `${a.nombre} ${a.apellido}`.toLowerCase().includes(alumnoSearch.toLowerCase())
  );

  const toggleAlumno = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return;
    const dbFields = modeToDbFields(visibilidad);
    await onSave(recurso.id, {
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || null,
      ...dbFields,
      alumno_ids: visibilidad === 'especificos' ? selectedIds : [],
      bloquear_descarga: bloquearDescarga,
    });
  };

  const showAlumnoSelector = alumnos.length > 0;

  const visOptions: { value: VisibilidadMode; Icon: React.ElementType; label: string }[] = [
    { value: 'mis_alumnos', Icon: Users,     label: t('todos_mis_alumnos') },
    { value: 'todos_app',   Icon: Globe,     label: t('todos_app') },
    { value: 'especificos', Icon: Building2, label: t('alumnos_especificos') },
  ];

  return (
    <Modal
      open
      onClose={onClose}
      title={t('editar_recurso')}
      description={recurso.tipo === 'archivo' ? recurso.storage_path?.split('/').pop() : recurso.url ?? undefined}
      preventOutsideClose={saving}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-50 min-h-[44px]"
          >
            {t('cancelar')}
          </button>
          <button
            type="submit"
            form="recurso-edit-form"
            disabled={saving || !titulo.trim()}
            className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-gold)] transition-all hover:opacity-90 disabled:opacity-50 min-h-[44px]"
          >
            {saving
              ? <><Loader2 className="size-4 animate-spin" />{t('guardando')}</>
              : <><Save className="size-4" />{t('guardar_cambios')}</>}
          </button>
        </div>
      }
    >
      <form id="recurso-edit-form" onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div>
          <label htmlFor="edit-titulo" className={labelCls}>{t('nombre_display')}</label>
          <input
            id="edit-titulo"
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={t('nombre_placeholder')}
            className={inputCls}
            required
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="edit-desc" className={labelCls}>{t('descripcion')}</label>
          <textarea
            id="edit-desc"
            rows={3}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder={t('descripcion_placeholder')}
            className={cn(inputCls, 'resize-none')}
          />
        </div>

        {/* Block download toggle */}
        {recurso.tipo === 'archivo' && (
          <div>
            <label className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 transition-colors hover:bg-[var(--color-bg-elevated)]">
              <div className="relative flex-shrink-0">
                <input
                  type="checkbox"
                  checked={bloquearDescarga}
                  onChange={(e) => setBloquearDescarga(e.target.checked)}
                  className="sr-only"
                />
                <div className={cn(
                  'h-5 w-9 rounded-full transition-colors',
                  bloquearDescarga ? 'bg-[var(--color-brand-gold)]' : 'bg-[var(--color-border)]',
                )} />
                <div className={cn(
                  'absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform',
                  bloquearDescarga ? 'translate-x-4' : 'translate-x-0.5',
                )} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">{t('bloquear_descarga')}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{t('bloquear_descarga_desc')}</p>
              </div>
            </label>
          </div>
        )}

        {/* Visibility selector */}
        {showAlumnoSelector && (
          <div className="space-y-2">
            <label className={labelCls}>{t('asignar_a')}</label>

            <div className="grid grid-cols-3 gap-1.5">
              {visOptions.map(({ value, Icon, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setVisibilidad(value);
                    if (value !== 'especificos') setSelectedIds([]);
                  }}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-[var(--radius-md)] border px-2 py-2.5 text-xs font-medium transition-colors text-center',
                    visibilidad === value
                      ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]',
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="leading-tight">{label}</span>
                </button>
              ))}
            </div>

            {visibilidad === 'todos_app' && (
              <p className="text-xs text-[var(--color-text-muted)]">{t('todos_app_desc')}</p>
            )}

            {visibilidad === 'especificos' && (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-2 space-y-1.5 max-h-52 overflow-y-auto">
                <input
                  type="text"
                  value={alumnoSearch}
                  onChange={(e) => setAlumnoSearch(e.target.value)}
                  placeholder={t('buscar_alumno')}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)]"
                />
                {loadingAcceso ? (
                  <div className="flex justify-center py-3">
                    <Loader2 className="size-5 animate-spin text-[var(--color-brand-gold)]" />
                  </div>
                ) : filteredAlumnos.length === 0 ? (
                  <p className="py-3 text-center text-xs text-[var(--color-text-muted)]">{t('sin_alumnos')}</p>
                ) : (
                  filteredAlumnos.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAlumno(a.id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-sm transition-colors text-left',
                        selectedIds.includes(a.id)
                          ? 'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]'
                          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]',
                      )}
                    >
                      <span className={cn(
                        'size-4 rounded border flex items-center justify-center flex-shrink-0',
                        selectedIds.includes(a.id)
                          ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold)]'
                          : 'border-[var(--color-border)]',
                      )}>
                        {selectedIds.includes(a.id) && <Check className="size-2.5 text-white" />}
                      </span>
                      {a.nombre} {a.apellido}
                    </button>
                  ))
                )}
              </div>
            )}

            {visibilidad === 'especificos' && selectedIds.length > 0 && (
              <p className="text-xs text-[var(--color-text-muted)]">
                {t('solo_asignados', { count: selectedIds.length })}
              </p>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
