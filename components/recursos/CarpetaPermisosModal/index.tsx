'use client';

import { useState, useMemo } from 'react';
import { Check, Save, Loader2, Globe, Users, Building2, AlertTriangle, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/common/Modal';
import type { CarpetaItem } from '@/components/recursos/CarpetaCard';
import type { RecursoItem } from '@/components/recursos/RecursoCard';
import type { VisibilidadMode } from '@/components/recursos/RecursoUploader/components/AlumnoAssignmentSelector';

const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]';

interface Alumno {
  id: string;
  nombre: string;
  apellido: string;
}

interface CarpetaPermisosModalProps {
  carpeta: CarpetaItem;
  recursosEnCarpeta: RecursoItem[];
  alumnos: Alumno[];
  onClose: () => void;
  onSave: (data: { para_todos: boolean; para_todos_app: boolean; alumno_ids: string[] }) => Promise<void>;
  saving: boolean;
}

function getInitialMode(carpeta: CarpetaItem): VisibilidadMode {
  // para_todos_efectivo covers both para_todos and para_todos_app from the RPC
  // We can't distinguish them from the folder level, so default to mis_alumnos when true
  if (carpeta.para_todos_efectivo) return 'mis_alumnos';
  if ((carpeta.alumno_ids_efectivos?.length ?? 0) > 0) return 'especificos';
  return 'mis_alumnos';
}

export function CarpetaPermisosModal({
  carpeta,
  recursosEnCarpeta,
  alumnos,
  onClose,
  onSave,
  saving,
}: CarpetaPermisosModalProps) {
  const t = useTranslations('recursos');

  const currentAlumnoIds = carpeta.alumno_ids_efectivos ?? [];

  const [visibilidad, setVisibilidad] = useState<VisibilidadMode>(getInitialMode(carpeta));
  const [selectedIds, setSelectedIds] = useState<string[]>(currentAlumnoIds);
  const [alumnoSearch, setAlumnoSearch] = useState('');

  const hasResources = recursosEnCarpeta.length > 0;

  const currentParaTodos = carpeta.para_todos_efectivo ?? false;

  const inheritedInfo = useMemo(() => {
    if (!hasResources) return null;
    if (currentParaTodos) return { type: 'todos' as const };
    if (currentAlumnoIds.length > 0) {
      return { type: 'especificos' as const, count: currentAlumnoIds.length };
    }
    return { type: 'ninguno' as const };
  }, [hasResources, currentParaTodos, currentAlumnoIds]);

  const isChanging = useMemo(() => {
    const initialMode = getInitialMode(carpeta);
    if (visibilidad !== initialMode) return true;
    if (visibilidad === 'especificos') {
      return JSON.stringify([...selectedIds].sort()) !== JSON.stringify([...currentAlumnoIds].sort());
    }
    return false;
  }, [visibilidad, selectedIds, currentAlumnoIds, carpeta]);

  const filteredAlumnos = alumnos.filter((a) =>
    `${a.nombre} ${a.apellido}`.toLowerCase().includes(alumnoSearch.toLowerCase())
  );

  const toggleAlumno = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      para_todos: visibilidad === 'mis_alumnos',
      para_todos_app: visibilidad === 'todos_app',
      alumno_ids: visibilidad === 'especificos' ? selectedIds : [],
    });
  };

  const visOptions: { value: VisibilidadMode; Icon: React.ElementType; label: string }[] = [
    { value: 'mis_alumnos', Icon: Users,     label: t('todos_mis_alumnos') },
    { value: 'todos_app',   Icon: Globe,     label: t('todos_app') },
    { value: 'especificos', Icon: Building2, label: t('alumnos_especificos') },
  ];

  return (
    <Modal
      open
      onClose={onClose}
      title={t('editar_permisos_carpeta')}
      description={carpeta.nombre}
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
            form="carpeta-permisos-form"
            disabled={saving || (visibilidad === 'especificos' && selectedIds.length === 0 && hasResources)}
            className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-gold)] transition-all hover:opacity-90 disabled:opacity-50 min-h-[44px]"
          >
            {saving
              ? <><Loader2 className="size-4 animate-spin" />{t('guardando')}</>
              : <><Save className="size-4" />{t('guardar_cambios')}</>}
          </button>
        </div>
      }
    >
      <form id="carpeta-permisos-form" onSubmit={handleSubmit} className="space-y-5">

        {/* Info banner */}
        {inheritedInfo && (
          <div className={cn(
            'flex items-start gap-2.5 rounded-[var(--radius-md)] border px-3 py-2.5 text-xs',
            inheritedInfo.type === 'ninguno'
              ? 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
              : 'border-[var(--color-info)]/30 bg-[rgba(44,95,138,0.06)] text-[var(--color-text-secondary)]',
          )}>
            <Info className="size-3.5 shrink-0 mt-0.5 text-[var(--color-info)]" />
            <div>
              <p className="font-medium text-[var(--color-text-primary)] mb-0.5">
                {t('carpeta_permisos_actuales')}
              </p>
              {inheritedInfo.type === 'todos' && <p>{t('carpeta_hereda_todos')}</p>}
              {inheritedInfo.type === 'especificos' && (
                <p>{t('carpeta_hereda_especificos', { count: inheritedInfo.count })}</p>
              )}
              {inheritedInfo.type === 'ninguno' && <p>{t('carpeta_sin_recursos_permisos')}</p>}
            </div>
          </div>
        )}

        {/* Propagation warning */}
        {isChanging && hasResources && (
          <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs dark:border-amber-800/40 dark:bg-amber-950/20">
            <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div className="text-amber-800 dark:text-amber-300">
              <p className="font-medium mb-0.5">{t('carpeta_propagacion_titulo')}</p>
              <p>{t('carpeta_propagacion_desc', { count: recursosEnCarpeta.length })}</p>
            </div>
          </div>
        )}

        {/* Visibility selector */}
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

          {visibilidad === 'especificos' && alumnos.length > 0 && (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-2 space-y-1.5 max-h-52 overflow-y-auto">
              <input
                type="text"
                value={alumnoSearch}
                onChange={(e) => setAlumnoSearch(e.target.value)}
                placeholder={t('buscar_alumno')}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)]"
              />
              {filteredAlumnos.length === 0 ? (
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
                    {currentAlumnoIds.includes(a.id) && !selectedIds.includes(a.id) && (
                      <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">{t('tenia_acceso')}</span>
                    )}
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
      </form>
    </Modal>
  );
}
