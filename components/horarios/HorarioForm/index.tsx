'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { horarioSchema, type HorarioFormData } from '@/lib/validations/horario.schema';
import { createClient } from '@/lib/supabase/client';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import type { Profile } from '@/lib/supabase/types';
import type { HorarioConAsistencia } from '@/lib/hooks/useHorarios';

interface HorarioFormProps {
  open: boolean;
  onClose: () => void;
  profesorId: string;
  horario?: HorarioConAsistencia | null;
  defaultDate?: string;
  defaultTime?: string;
  onSuccess: () => void;
  cachedAlumnos?: { id: string; nombre: string; apellido: string; email: string; avatar_url: string | null }[];
  /** Admin mode: pass all professors to show a professor selector */
  adminProfesores?: { id: string; nombre: string; apellido: string }[];
}

export function HorarioForm({ open, onClose, profesorId, horario, defaultDate, defaultTime, onSuccess, cachedAlumnos, adminProfesores }: HorarioFormProps) {
  const t = useTranslations('horarios');
  const tc = useTranslations('common');
  const ta = useTranslations('alumnos');
  const queryClient = useQueryClient();
  const [alumnos, setAlumnos] = useState<Profile[]>([]);
  const [loadingAlumnos, setLoadingAlumnos] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [alumnoSearch, setAlumnoSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // In admin mode, track which professor will teach this class
  const [activeProfId, setActiveProfId] = useState(profesorId);
  const isEditing = !!horario;

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<HorarioFormData>({
    resolver: zodResolver(horarioSchema),
    defaultValues: {
      alumno_id: '',
      titulo: '',
      descripcion: '',
      fecha: '',
      hora_inicio: '',
      hora_fin: '',
    },
  });

  const selectedAlumnoId = watch('alumno_id');
  const horaInicio = watch('hora_inicio');

  // Auto-fill hora_fin = hora_inicio + 1h (only when creating)
  useEffect(() => {
    if (horaInicio && !isEditing) {
      const [h, m] = horaInicio.split(':').map(Number);
      const endH = Math.min(h + 1, 23);
      setValue('hora_fin', `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }, [horaInicio, isEditing, setValue]);

  // Reset form when horario or open changes
  useEffect(() => {
    if (!open) return;
    // Admin mode: init activeProfId from edited horario or prop
    if (adminProfesores) {
      setActiveProfId((horario?.profesor_id as string) || profesorId || '');
    }
    if (horario) {
      reset({
        alumno_id: horario.alumno_id,
        titulo: horario.titulo,
        descripcion: horario.descripcion || '',
        fecha: horario.fecha,
        hora_inicio: horario.hora_inicio.slice(0, 5),
        hora_fin: horario.hora_fin.slice(0, 5),
      });
      setAlumnoSearch(
        horario.alumno ? `${horario.alumno.nombre} ${horario.alumno.apellido}` : ''
      );
    } else {
      const endTime = defaultTime
        ? `${String(Math.min(Number(defaultTime.split(':')[0]) + 1, 23)).padStart(2, '0')}:${defaultTime.split(':')[1]}`
        : '';
      reset({
        alumno_id: '',
        titulo: '',
        descripcion: '',
        fecha: defaultDate || '',
        hora_inicio: defaultTime || '',
        hora_fin: endTime,
      });
      setAlumnoSearch('');
    }
  }, [horario, defaultDate, defaultTime, open, reset]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync search text when selected alumno changes from external source
  useEffect(() => {
    if (selectedAlumnoId && alumnos.length > 0) {
      const found = alumnos.find((a) => a.id === selectedAlumnoId);
      if (found) setAlumnoSearch(`${found.nombre} ${found.apellido}`);
    }
  }, [selectedAlumnoId, alumnos]);

  // Use cached alumnos from parent (SP) or fetch as fallback
  useEffect(() => {
    if (!adminProfesores && cachedAlumnos && cachedAlumnos.length > 0) {
      setAlumnos(cachedAlumnos as Profile[]);
      setLoadingAlumnos(false);
      return;
    }
    const fetchTargetId = adminProfesores ? activeProfId : profesorId;
    async function fetchAlumnos() {
      if (!fetchTargetId) { setAlumnos([]); return; }
      setLoadingAlumnos(true);
      try {
        const supabase = createClient();
        if (adminProfesores) {
          // Admin mode: all active alumnos (substitute professors can teach anyone)
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, nombre, apellido, email, telefono, avatar_url, activo, rol, created_at, updated_at')
            .eq('rol', 'alumno')
            .eq('activo', true)
            .order('nombre');
          if (profiles) setAlumnos(profiles as Profile[]);
        } else {
          const { data, error } = await supabase
            .from('alumnos_extra')
            .select('alumno_id')
            .eq('profesor_id', fetchTargetId);
          if (error) { console.error('Error fetching alumnos_extra:', error.message); return; }
          if (data && data.length > 0) {
            const ids = data.map((d) => d.alumno_id);
            const { data: profiles, error: profilesError } = await supabase
              .from('profiles')
              .select('*')
              .in('id', ids)
              .eq('activo', true)
              .order('nombre');
            if (profilesError) { console.error('Error fetching profiles:', profilesError.message); return; }
            if (profiles) setAlumnos(profiles);
          } else {
            setAlumnos([]);
          }
        }
      } catch (err) {
        console.error('Error in fetchAlumnos:', err);
      } finally {
        setLoadingAlumnos(false);
      }
    }
    if (open) fetchAlumnos();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profesorId, activeProfId, cachedAlumnos, adminProfesores]);

  // Filter alumnos for the dropdown — show all when search is empty
  const filteredAlumnos = useMemo(() => {
    if (!alumnoSearch.trim()) return alumnos;
    // If the search matches the currently selected alumno exactly, show all
    const selected = alumnos.find((a) => a.id === selectedAlumnoId);
    if (selected && alumnoSearch === `${selected.nombre} ${selected.apellido}`) return alumnos;
    const q = alumnoSearch.toLowerCase();
    return alumnos.filter((a) =>
      `${a.nombre} ${a.apellido}`.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q)
    );
  }, [alumnos, alumnoSearch, selectedAlumnoId]);

  async function onSubmit(formData: HorarioFormData) {
    try {
      const url = isEditing ? `/api/horarios/${horario.id}` : '/api/horarios';
      const method = isEditing ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          // Admin mode: send chosen professor_id
          ...(adminProfesores && activeProfId ? { profesor_id: activeProfId } : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al guardar');
      }

      toast.success(isEditing ? t('exito_actualizado') : t('exito_creado'));
      // Invalidate all horarios and asistencia caches (affects profesor calendar + alumno schedule)
      queryClient.invalidateQueries({ queryKey: ['horarios'] });
      queryClient.invalidateQueries({ queryKey: ['asistencia'] });
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error_guardar'));
    }
  }

  async function handleDelete() {
    if (!horario) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/horarios/${horario.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(t('error_eliminar'));
      toast.success(t('exito_eliminado'));
      queryClient.invalidateQueries({ queryKey: ['horarios'] });
      queryClient.invalidateQueries({ queryKey: ['asistencia'] });
      onSuccess();
      onClose();
    } catch {
      toast.error(t('error_eliminar'));
    } finally {
      setDeleting(false);
    }
  }

  const inputClass = "w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? t('editar_clase') : t('nueva_clase')}
      description={isEditing ? t('editar_descripcion') : t('nueva_descripcion')}
      footer={
        <div className="flex w-full items-center justify-between">
          {isEditing ? (
            <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>
              {tc('eliminar')}
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>{tc('cancelar')}</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
              {isEditing ? t('guardar_cambios') : t('crear_clase')}
            </Button>
          </div>
        </div>
      }
    >
      <form className="space-y-4">
        {/* Admin: professor selector */}
        {adminProfesores && adminProfesores.length > 0 && (
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Profesor</label>
            <select
              value={activeProfId}
              onChange={(e) => {
                setActiveProfId(e.target.value);
                // Clear alumno when professor changes
                setValue('alumno_id', '');
                setAlumnoSearch('');
              }}
              className={inputClass}
            >
              <option value="">Seleccionar profesor</option>
              {adminProfesores.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>
              ))}
            </select>
          </div>
        )}

        {/* Alumno — searchable combo dropdown */}
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">{t('campo_alumno')}</label>
          <div className="relative" ref={dropdownRef}>
            <input
              type="text"
              value={alumnoSearch}
              onChange={(e) => {
                setAlumnoSearch(e.target.value);
                setShowDropdown(true);
                if (!e.target.value) setValue('alumno_id', '');
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder={t('buscar_alumno_placeholder')}
              className={inputClass}
              autoComplete="off"
            />
            {showDropdown && (
              <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-lg">
                {loadingAlumnos ? (
                  <div className="flex items-center justify-center py-3">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-brand-gold)] border-t-transparent" />
                    <span className="ml-2 text-sm text-[var(--color-text-muted)]">{tc('cargando')}</span>
                  </div>
                ) : filteredAlumnos.length > 0 ? (
                  filteredAlumnos.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-bg-secondary)] ${
                        selectedAlumnoId === a.id ? 'bg-[var(--color-bg-secondary)] font-medium' : ''
                      }`}
                      onClick={() => {
                        setValue('alumno_id', a.id, { shouldValidate: true });
                        setAlumnoSearch(`${a.nombre} ${a.apellido}`);
                        setShowDropdown(false);
                      }}
                    >
                      <span className="text-[var(--color-text-primary)]">{a.nombre} {a.apellido}</span>
                      <span className="ml-2 text-xs text-[var(--color-text-muted)]">{a.email}</span>
                    </button>
                  ))
                ) : alumnos.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-[var(--color-text-muted)]">
                    {ta('sin_alumnos')}
                  </p>
                ) : (
                  <p className="px-3 py-2 text-sm text-[var(--color-text-muted)]">
                    {t('no_alumnos_encontrados')}
                  </p>
                )}
              </div>
            )}
          </div>
          {errors.alumno_id && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.alumno_id.message}</p>}
        </div>

        {/* Titulo */}
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">{t('titulo_clase')}</label>
          <input
            type="text"
            {...register('titulo')}
            placeholder={t('titulo_placeholder')}
            className={inputClass}
          />
          {errors.titulo && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.titulo.message}</p>}
        </div>

        {/* Descripcion */}
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">{t('descripcion')} <span className="text-[var(--color-text-muted)]">{t('opcional')}</span></label>
          <textarea
            {...register('descripcion')}
            rows={3}
            placeholder={t('descripcion_placeholder')}
            className={inputClass}
          />
          {errors.descripcion && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.descripcion.message}</p>}
        </div>

        {/* Fecha */}
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">{t('fecha')}</label>
          <input
            type="date"
            {...register('fecha')}
            className={inputClass}
          />
          {errors.fecha && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.fecha.message}</p>}
        </div>

        {/* Horas */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">{t('hora_inicio')}</label>
            <input
              type="time"
              {...register('hora_inicio')}
              className={inputClass}
            />
            {errors.hora_inicio && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.hora_inicio.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">{t('hora_fin')}</label>
            <input
              type="time"
              {...register('hora_fin')}
              className={inputClass}
            />
            {errors.hora_fin && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.hora_fin.message}</p>}
          </div>
        </div>
      </form>
    </Modal>
  );
}
