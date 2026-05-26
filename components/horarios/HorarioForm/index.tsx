'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { horarioSchema, type HorarioFormData } from '@/lib/validations/horario.schema';
import { createClient } from '@/lib/supabase/client';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import type { Profile } from '@/lib/supabase/types';
import type { HorarioConAsistencia } from '@/lib/hooks/useHorarios';
import { AlumnoCombobox } from './components/AlumnoCombobox';
import { ExamenToggle } from './components/ExamenToggle';

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

/** Fetch alumnos for a given professor (or all active alumnos in admin mode) */
async function fetchAlumnosForProfesor(fetchTargetId: string, isAdmin: boolean): Promise<Profile[]> {
  if (!fetchTargetId) return [];
  const supabase = createClient();
  if (isAdmin) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, nombre, apellido, email, telefono, avatar_url, activo, rol, created_at, updated_at')
      .eq('rol', 'alumno')
      .eq('activo', true)
      .order('nombre');
    return (profiles as Profile[]) ?? [];
  }
  const { data, error } = await supabase
    .from('alumnos_extra')
    .select('alumno_id')
    .eq('profesor_id', fetchTargetId);
  if (error || !data || data.length === 0) return [];
  const ids = data.map((d) => d.alumno_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .in('id', ids)
    .eq('activo', true)
    .order('nombre');
  return (profiles as Profile[]) ?? [];
}

export function HorarioForm({ open, onClose, profesorId, horario, defaultDate, defaultTime, onSuccess, cachedAlumnos, adminProfesores }: HorarioFormProps) {
  const t = useTranslations('horarios');
  const tc = useTranslations('common');
  const ta = useTranslations('alumnos');
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const [alumnoSearch, setAlumnoSearch] = useState('');
  // In admin mode, track which professor will teach this class
  const [activeProfId, setActiveProfId] = useState(profesorId);
  const [esExamen, setEsExamen] = useState(false);
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
    } else {
      setActiveProfId(profesorId);
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
      // Check if this class already has a linked prueba
      const supabase = createClient();
      supabase
        .from('pruebas')
        .select('id')
        .eq('horario_id', horario.id)
        .maybeSingle()
        .then(({ data }) => setEsExamen(!!data));
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
      setEsExamen(false);
    }
  }, [horario, defaultDate, defaultTime, open, reset, adminProfesores, profesorId]);

  // Fetch alumnos using React Query — eliminates the effect chain
  const fetchTargetId = adminProfesores ? activeProfId : profesorId;
  const useCachedAlumnos = !adminProfesores && cachedAlumnos && cachedAlumnos.length > 0;

  const { data: fetchedAlumnos = [], isLoading: loadingAlumnos } = useQuery({
    queryKey: ['form-alumnos', fetchTargetId, !!adminProfesores],
    queryFn: () => fetchAlumnosForProfesor(fetchTargetId, !!adminProfesores),
    enabled: open && !!fetchTargetId && !useCachedAlumnos,
    staleTime: 60_000,
  });

  // Derive alumnos list: use cached if available, otherwise fetched
  const alumnos: Profile[] = useMemo(
    () => useCachedAlumnos ? (cachedAlumnos as Profile[]) : fetchedAlumnos,
    [useCachedAlumnos, cachedAlumnos, fetchedAlumnos]
  );

  // Sync search text when selected alumno changes — derived during render, no effect needed
  const syncedAlumnoSearch = useMemo(() => {
    if (selectedAlumnoId && alumnos.length > 0) {
      const found = alumnos.find((a) => a.id === selectedAlumnoId);
      if (found) return `${found.nombre} ${found.apellido}`;
    }
    return null;
  }, [selectedAlumnoId, alumnos]);

  // Only sync once when alumnos load and there's a selected ID (e.g. editing)
  const prevSyncRef = useRef<string | null>(null);
  useEffect(() => {
    if (syncedAlumnoSearch && syncedAlumnoSearch !== prevSyncRef.current) {
      prevSyncRef.current = syncedAlumnoSearch;
      setAlumnoSearch(syncedAlumnoSearch);
    }
  }, [syncedAlumnoSearch]);

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
          es_prueba: esExamen,
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
      queryClient.invalidateQueries({ queryKey: ['pruebas'] });
      queryClient.invalidateQueries({ queryKey: ['admin-clases-hoy'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
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
      queryClient.invalidateQueries({ queryKey: ['pruebas'] });
      queryClient.invalidateQueries({ queryKey: ['admin-clases-hoy'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      onSuccess();
      onClose();
    } catch {
      toast.error(t('error_eliminar'));
    } finally {
      setDeleting(false);
    }
  }

  const inputClass = "w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]";

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
          <AlumnoCombobox
            alumnos={alumnos}
            loading={loadingAlumnos}
            selectedId={selectedAlumnoId}
            searchText={alumnoSearch}
            onSearchChange={(text) => {
              setAlumnoSearch(text);
              if (!text) setValue('alumno_id', '');
            }}
            onSelect={(id, displayName) => {
              setValue('alumno_id', id, { shouldValidate: true });
              setAlumnoSearch(displayName);
            }}
            placeholder={t('buscar_alumno_placeholder')}
            emptyMessage={ta('sin_alumnos')}
            noResultsMessage={t('no_alumnos_encontrados')}
            loadingMessage={tc('cargando')}
            inputClassName={inputClass}
            filteredAlumnos={filteredAlumnos}
          />
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

        {/* Es Examen toggle */}
        <ExamenToggle
          checked={esExamen}
          onChange={setEsExamen}
          label={t('es_examen')}
          description={t('es_examen_desc')}
        />
      </form>
    </Modal>
  );
}
