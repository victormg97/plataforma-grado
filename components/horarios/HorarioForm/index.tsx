'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';
import { horarioSchema, type HorarioFormData } from '@/lib/validations/horario.schema';
import { createClient } from '@/lib/supabase/client';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Tooltip } from '@/components/common/Tooltip';
import { AppSelect } from '@/components/common/AppSelect';
import type { Profile } from '@/lib/supabase/types';
import type { HorarioConAsistencia } from '@/lib/hooks/useHorarios';
import { AlumnoCombobox } from './components/AlumnoCombobox';
import { TipoClaseSelector, type TipoClaseValue } from '@/components/horarios/TipoClaseSelector';
import { ComisionMultiSelect, type ProfesorComisionOption } from '@/components/horarios/ComisionMultiSelect';
import { SimpleRichEditor } from '@/components/common/SimpleRichEditor';

interface HorarioFormProps {
  open: boolean;
  onClose: () => void;
  profesorId: string;
  horario?: HorarioConAsistencia | null;
  defaultDate?: string;
  defaultTime?: string;
  /** Optional explicit end time. When omitted, the form auto-fills start + 1h. */
  defaultEndTime?: string;
  /** When true (and creating), the form opens directly in "bloqueo de horario" mode. */
  defaultBloqueo?: boolean;
  onSuccess: () => void;
  cachedAlumnos?: { id: string; nombre: string; apellido: string; email: string; avatar_url: string | null }[];
  /** Admin mode: pass all professors to show a professor selector */
  adminProfesores?: { id: string; nombre: string; apellido: string }[];
  /** When 'inline', renders form content without its own Modal wrapper. */
  renderMode?: 'modal' | 'inline';
  /** Callback to report dirty state to parent (used in inline mode). */
  onDirtyChange?: (dirty: boolean) => void;
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

export function HorarioForm({ open, onClose, profesorId, horario, defaultDate, defaultTime, defaultEndTime, defaultBloqueo, onSuccess, cachedAlumnos, adminProfesores, renderMode = 'modal', onDirtyChange }: HorarioFormProps) {
  const t = useTranslations('horarios');
  const tc = useTranslations('common');
  const ta = useTranslations('alumnos');
  const tConexion = useTranslations('agendaConexion');
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const [alumnoSearch, setAlumnoSearch] = useState('');
  // In admin mode, track which professor will teach this class
  const [activeProfId, setActiveProfId] = useState(profesorId);
  const [tipoClase, setTipoClase] = useState<TipoClaseValue>('normal');
  const [comisionIds, setComisionIds] = useState<string[]>([]);
  // Bloqueo de horario mode — only available when creating (not editing)
  const [esBloqueo, setEsBloqueo] = useState(false);
  // Bloqueo form state — fully independent from the horario RHF form
  const [bloqueoFecha, setBloqueoFecha] = useState('');
  const [bloqueoHoraInicio, setBloqueoHoraInicio] = useState('');
  const [bloqueoHoraFin, setBloqueoHoraFin] = useState('');
  const [motivoBloqueo, setMotivoBloqueo] = useState('');
  const [submittingBloqueo, setSubmittingBloqueo] = useState(false);
  const isEditing = !!horario;

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting, isDirty } } = useForm<HorarioFormData>({
    resolver: zodResolver(horarioSchema),
    defaultValues: {
      alumno_id: '',
      titulo: '',
      descripcion: '',
      fecha: '',
      hora_inicio: '',
      hora_fin: '',
      enlace_conexion: '',
    },
  });

  // Register fields that use value+onChange pattern instead of register spread
  // This ensures handleSubmit picks them up correctly
  useEffect(() => {
    register('titulo');
    register('descripcion');
    register('fecha');
    register('hora_inicio');
    register('hora_fin');
  }, [register]);

  const selectedAlumnoId = watch('alumno_id');
  // Watch all fields to guarantee controlled inputs (never undefined)
  const watchedTitulo = watch('titulo') ?? '';
  const watchedDescripcion = watch('descripcion') ?? '';
  const watchedFecha = watch('fecha') ?? '';
  const watchedHoraInicio = watch('hora_inicio') ?? '';
  const watchedHoraFin = watch('hora_fin') ?? '';
  const watchedEnlaceConexion = watch('enlace_conexion') ?? '';

  // Report dirty state to parent (inline mode)
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Auto-fill hora_fin = hora_inicio + 1h (only when creating)
  useEffect(() => {
    if (watchedHoraInicio && !isEditing) {
      const [h, m] = watchedHoraInicio.split(':').map(Number);
      const endH = Math.min(h + 1, 23);
      setValue('hora_fin', `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }, [watchedHoraInicio, isEditing, setValue]);

  // Reset form when horario or open changes
  useEffect(() => {
    if (!open) return;
    // Reset bloqueo mode when opening — honor defaultBloqueo (e.g. all-day cell click)
    setEsBloqueo(!isEditing && !!defaultBloqueo);
    setMotivoBloqueo('');
    // Pre-fill bloqueo date/time from defaults (same as the class form)
    setBloqueoFecha(defaultDate || '');
    setBloqueoHoraInicio(defaultTime || '');
    setBloqueoHoraFin(
      defaultEndTime
        ? defaultEndTime
        : defaultTime
          ? `${String(Math.min(Number(defaultTime.split(':')[0]) + 1, 23)).padStart(2, '0')}:${defaultTime.split(':')[1]}`
          : ''
    );
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
        enlace_conexion: horario.enlace_conexion || '',
      });
      setAlumnoSearch(
        horario.alumno ? `${horario.alumno.nombre} ${horario.alumno.apellido}` : ''
      );
      // Check if this class already has a linked prueba or tipo_clase
      if (horario.tipo_clase) {
        setTipoClase(horario.tipo_clase as TipoClaseValue);
      } else {
        const supabase = createClient();
        supabase
          .from('pruebas')
          .select('id')
          .eq('horario_id', horario.id)
          .maybeSingle()
          .then(({ data }) => setTipoClase(data ? 'interrogacion' : 'normal'));
      }
      setComisionIds([]);
    } else {
      const endTime = defaultEndTime
        ? defaultEndTime
        : defaultTime
          ? `${String(Math.min(Number(defaultTime.split(':')[0]) + 1, 23)).padStart(2, '0')}:${defaultTime.split(':')[1]}`
          : '';
      reset({
        alumno_id: '',
        titulo: '',
        descripcion: '',
        fecha: defaultDate || '',
        hora_inicio: defaultTime || '',
        hora_fin: endTime,
        enlace_conexion: '',
      });
      setAlumnoSearch('');
      setTipoClase('normal');
      setComisionIds([]);
    }
  }, [horario, defaultDate, defaultTime, defaultEndTime, defaultBloqueo, open, reset, adminProfesores, profesorId, isEditing]);

  // Fetch alumnos using React Query — eliminates the effect chain
  const fetchTargetId = adminProfesores ? activeProfId : profesorId;
  const useCachedAlumnos = !adminProfesores && cachedAlumnos && cachedAlumnos.length > 0;

  // In admin mode the alumno selector is locked until a professor is chosen.
  const alumnoSelectorDisabled = !!adminProfesores && !isEditing && !activeProfId;

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

  // Fetch profesores/admins for comisión multi-select (simulación)
  const { data: profesoresComision = [] } = useQuery<ProfesorComisionOption[]>({
    queryKey: ['profesores-comision'],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('profiles')
        .select('id, nombre, apellido, avatar_url')
        .in('rol', ['admin', 'profesor'])
        .eq('activo', true)
        .order('nombre');
      return (data ?? []) as ProfesorComisionOption[];
    },
    enabled: open && tipoClase === 'simulacion',
    staleTime: 60_000,
  });

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

  async function onSubmitBloqueo() {
    if (adminProfesores && !activeProfId) {
      toast.error(t('debe_seleccionar_profesor'));
      return;
    }
    if (!bloqueoFecha || !bloqueoHoraInicio || !bloqueoHoraFin) {
      toast.error(t('bloqueo_campos_requeridos'));
      return;
    }
    if (bloqueoHoraFin <= bloqueoHoraInicio) {
      toast.error(t('error_hora_fin'));
      return;
    }

    setSubmittingBloqueo(true);
    try {
      const res = await fetch('/api/bloqueos-horario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: bloqueoFecha,
          hora_inicio: bloqueoHoraInicio,
          hora_fin: bloqueoHoraFin,
          motivo: motivoBloqueo.trim() || null,
          ...(adminProfesores && activeProfId ? { profesor_id: activeProfId } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t('error_guardar'));
      }
      toast.success(t('bloqueo_creado'));
      queryClient.invalidateQueries({ queryKey: ['bloqueos-horario'] });
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error_guardar'));
    } finally {
      setSubmittingBloqueo(false);
    }
  }

  async function onSubmit(formData: HorarioFormData) {
    try {
      const url = isEditing ? `/api/horarios/${horario.id}` : '/api/horarios';
      const method = isEditing ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          tipo_clase: tipoClase,
          es_prueba: tipoClase === 'interrogacion',
          ...(tipoClase === 'simulacion' ? { comision_ids: comisionIds } : {}),
          // Admin mode: send chosen professor_id
          ...(adminProfesores && activeProfId ? { profesor_id: activeProfId } : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al guardar');
      }

      const responseData = await res.json();
      toast.success(isEditing ? t('exito_actualizado') : t('exito_creado'));

      // Show optimistic email toast when creating a new class
      if (!isEditing && responseData.email_intentado) {
        toast.success(t('correo_enviado_alumno'), { duration: 5000 });
      }
      // Invalidate all horarios and asistencia caches (affects profesor calendar + alumno schedule)
      queryClient.invalidateQueries({ queryKey: ['horarios'] });
      queryClient.invalidateQueries({ queryKey: ['admin-horarios'] });
      queryClient.invalidateQueries({ queryKey: ['asistencia'] });
      queryClient.invalidateQueries({ queryKey: ['pruebas'] });
      queryClient.invalidateQueries({ queryKey: ['ficha-alumno'] });
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
      queryClient.invalidateQueries({ queryKey: ['admin-horarios'] });
      queryClient.invalidateQueries({ queryKey: ['asistencia'] });
      queryClient.invalidateQueries({ queryKey: ['pruebas'] });
      queryClient.invalidateQueries({ queryKey: ['ficha-alumno'] });
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

  const footerContent = (
    <div className="flex w-full items-center justify-between gap-3">
      {/* Izquierda: eliminar (editing) | switch bloqueo (creating) */}
      {isEditing ? (
        <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>
          {tc('eliminar')}
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => setEsBloqueo((v) => !v)}
          className={`inline-flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-gold)] ${
            esBloqueo
              ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]'
              : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          <Lock className="size-3.5 shrink-0" />
          {t('bloqueo_switch')}
          {/* Toggle pill */}
          <span
            className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
              esBloqueo ? 'bg-[var(--color-brand-gold)]' : 'bg-[var(--color-border)]'
            }`}
          >
            <span
              className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${
                esBloqueo ? 'translate-x-3.5' : 'translate-x-0.5'
              }`}
            />
          </span>
        </button>
      )}

      {/* Derecha: cancelar + guardar */}
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onClose}>{tc('cancelar')}</Button>
        {esBloqueo ? (
          <Button onClick={onSubmitBloqueo} loading={submittingBloqueo} disabled={!!adminProfesores && !activeProfId}>
            {t('bloqueo_guardar')}
          </Button>
        ) : (
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            {isEditing ? t('guardar_cambios') : t('crear_clase')}
          </Button>
        )}
      </div>
    </div>
  );

  const formContent = (
    <form className="space-y-4">
      {/* Admin: professor selector */}
      {adminProfesores && adminProfesores.length > 0 && (
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">Profesor</label>
          <AppSelect
            value={activeProfId}
            onChange={(value) => {
              setActiveProfId(value);
              // Clear alumno when professor changes
              setValue('alumno_id', '');
              setAlumnoSearch('');
            }}
            options={adminProfesores.map((p) => ({ value: p.id, label: `${p.nombre} ${p.apellido}` }))}
            placeholder="Seleccionar profesor"
            className="w-full"
          />
        </div>
      )}

      {/* ── Modo bloqueo: solo fecha, horas y motivo ── */}
      {esBloqueo && !isEditing ? (
        <>
          {/* Banner informativo */}
          <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-brand-gold)]/30 bg-[var(--color-brand-gold-muted)] px-3 py-2.5">
            <Lock className="mt-0.5 size-3.5 shrink-0 text-[var(--color-brand-gold)]" />
            <p className="text-xs text-[var(--color-brand-gold)]">{t('bloqueo_info')}</p>
          </div>

          {/* Fecha */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">{t('fecha')}</label>
            <Tooltip content={t('tooltip_fecha')} position="top" className="w-full">
              <input
                type="date"
                value={bloqueoFecha}
                onChange={(e) => setBloqueoFecha(e.target.value)}
                className={`${inputClass} w-full`}
              />
            </Tooltip>
          </div>

          {/* Horas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">{t('hora_inicio')}</label>
              <Tooltip content={t('tooltip_hora_inicio')} position="top" className="w-full">
                <input
                  type="time"
                  value={bloqueoHoraInicio}
                  onChange={(e) => {
                    setBloqueoHoraInicio(e.target.value);
                    // Auto-fill hora_fin = hora_inicio + 1h
                    if (e.target.value) {
                      const [h, m] = e.target.value.split(':').map(Number);
                      const endH = Math.min(h + 1, 23);
                      setBloqueoHoraFin(`${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
                    }
                  }}
                  className={`${inputClass} w-full`}
                />
              </Tooltip>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">{t('hora_fin')}</label>
              <Tooltip content={t('tooltip_hora_fin')} position="top" className="w-full">
                <input
                  type="time"
                  value={bloqueoHoraFin}
                  onChange={(e) => setBloqueoHoraFin(e.target.value)}
                  className={`${inputClass} w-full`}
                />
              </Tooltip>
            </div>
          </div>

          {/* Motivo (opcional) */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              {t('bloqueo_motivo')} <span className="text-[var(--color-text-muted)]">{t('opcional')}</span>
            </label>
            <input
              type="text"
              value={motivoBloqueo}
              onChange={(e) => setMotivoBloqueo(e.target.value)}
              placeholder={t('bloqueo_motivo_placeholder')}
              className={inputClass}
              maxLength={200}
            />
          </div>
        </>
      ) : (
        <>
          {/* ── Modo clase normal ── */}

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
              placeholder={alumnoSelectorDisabled ? t('debe_seleccionar_profesor') : t('buscar_alumno_placeholder')}
              emptyMessage={alumnoSelectorDisabled ? t('debe_seleccionar_profesor') : ta('sin_alumnos')}
              noResultsMessage={t('no_alumnos_encontrados')}
              loadingMessage={tc('cargando')}
              inputClassName={inputClass}
              filteredAlumnos={filteredAlumnos}
              disabled={alumnoSelectorDisabled}
            />
            {errors.alumno_id && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.alumno_id.message}</p>}
          </div>

          {/* Titulo */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">{t('titulo_clase')}</label>
            <input
              type="text"
              value={watchedTitulo}
              onChange={(e) => setValue('titulo', e.target.value, { shouldValidate: !!errors.titulo })}
              onBlur={() => setValue('titulo', watchedTitulo, { shouldValidate: true })}
              placeholder={t('titulo_placeholder')}
              className={inputClass}
            />
            {errors.titulo && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.titulo.message}</p>}
          </div>

          {/* Descripcion */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">{t('descripcion')} <span className="text-[var(--color-text-muted)]">{t('opcional')}</span></label>
            <SimpleRichEditor
              content={watchedDescripcion}
              onChange={(html) => setValue('descripcion', html)}
              placeholder={t('descripcion_placeholder')}
            />
            {errors.descripcion && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.descripcion.message}</p>}
          </div>

          {/* Enlace de conexión (opcional) */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              {tConexion('campo_label')} <span className="text-[var(--color-text-muted)]">{t('opcional')}</span>
            </label>
            <input
              type="url"
              value={watchedEnlaceConexion}
              onChange={(e) => setValue('enlace_conexion', e.target.value, { shouldValidate: !!errors.enlace_conexion })}
              placeholder={tConexion('campo_placeholder')}
              className={inputClass}
            />
            {errors.enlace_conexion && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.enlace_conexion.message}</p>}
          </div>

          {/* Fecha */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">{t('fecha')}</label>
            <Tooltip content={t('tooltip_fecha')} position="top" className="w-full">
              <input
                type="date"
                value={watchedFecha}
                onChange={(e) => setValue('fecha', e.target.value, { shouldValidate: !!errors.fecha })}
                className={`${inputClass} w-full`}
              />
            </Tooltip>
            {errors.fecha && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.fecha.message}</p>}
          </div>

          {/* Horas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">{t('hora_inicio')}</label>
              <Tooltip content={t('tooltip_hora_inicio')} position="top" className="w-full">
                <input
                  type="time"
                  value={watchedHoraInicio}
                  onChange={(e) => setValue('hora_inicio', e.target.value, { shouldValidate: !!errors.hora_inicio })}
                  className={`${inputClass} w-full`}
                />
              </Tooltip>
              {errors.hora_inicio && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.hora_inicio.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">{t('hora_fin')}</label>
              <Tooltip content={t('tooltip_hora_fin')} position="top" className="w-full">
                <input
                  type="time"
                  value={watchedHoraFin}
                  onChange={(e) => setValue('hora_fin', e.target.value, { shouldValidate: !!errors.hora_fin })}
                  className={`${inputClass} w-full`}
                />
              </Tooltip>
              {errors.hora_fin && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.hora_fin.message}</p>}
            </div>
          </div>

          {/* Tipo de Clase selector (replaces ExamenToggle) */}
          <TipoClaseSelector
            value={tipoClase}
            onChange={(tipo) => {
              setTipoClase(tipo);
              if (tipo !== 'simulacion') setComisionIds([]);
            }}
          />

          {/* Comision multi-select — only for simulacion */}
          {tipoClase === 'simulacion' && (
            <ComisionMultiSelect
              selectedIds={comisionIds}
              onChange={setComisionIds}
              profesorResponsableId={activeProfId}
              profesores={profesoresComision}
            />
          )}
        </>
      )}
    </form>
  );

  // Inline mode: render form + footer without Modal wrapper
  if (renderMode === 'inline') {
    return (
      <div className="flex flex-col">
        <div className="flex-1">{formContent}</div>
        <div className="mt-4 border-t border-[var(--color-border)] pt-4">{footerContent}</div>
      </div>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        isEditing
          ? t('editar_clase')
          : esBloqueo
            ? t('bloqueo_titulo')
            : t('nueva_clase')
      }
      description={
        isEditing
          ? t('editar_descripcion')
          : esBloqueo
            ? t('bloqueo_descripcion')
            : t('nueva_descripcion')
      }
      footer={footerContent}
    >
      {formContent}
    </Modal>
  );
}
