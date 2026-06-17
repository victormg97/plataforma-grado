'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/stores/useUserStore';
import { AvatarUploadSection } from '@/components/common/AvatarUploadSection';
import { LanguageSelector } from '@/components/common/LanguageSelector';
import { cn } from '@/lib/utils';
import { validarAño } from '@/lib/validations/año';
import {
  User, Lock, Eye, EyeOff, Globe,
  ArrowLeft, Save, Loader2, ClipboardCheck, Settings2,
} from 'lucide-react';
import type { Profile, AlumnoExtra } from '@/lib/supabase/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type PerfilResponse = Profile & {
  apellido_materno?: string | null;
  duracion_clase_default_min?: number;
  cancellation_deadline_hours?: number;
  email_disponible?: boolean;
  alumno_extra: Pick<AlumnoExtra, 'universidad' | 'año_ingreso' | 'año_egreso' | 'ha_dado_examen' | 'intentos_prueba'> | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getApellidosDisplay(profile: PerfilResponse): string {
  return [profile.apellido, profile.apellido_materno].filter(Boolean).join(' ');
}

const inputCls = cn(
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)]',
  'bg-[var(--color-bg)] px-3 py-2.5 text-sm text-[var(--color-text-primary)]',
  'placeholder:text-[var(--color-text-muted)]',
  'focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]',
  'transition-colors',
);

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-6">
      <div className="flex size-8 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-brand-gold)_12%,transparent)]">
        <Icon className="size-4 text-[var(--color-brand-gold)]" />
      </div>
      <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{title}</h2>
    </div>
  );
}

function Field({ label, hint, children, inline }: { label: string; hint?: string; children: React.ReactNode; inline?: boolean }) {
  return (
    <div className={cn(
      'grid grid-cols-1 gap-1.5 sm:grid-cols-[220px_1fr] sm:gap-6',
      inline ? 'sm:items-center' : 'sm:items-start',
    )}>
      <div className={inline ? undefined : 'pt-2.5'}>
        <span className="text-sm font-medium text-[var(--color-text-primary)]">{label}</span>
        {hint && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SaveBar({ saving, label, disabled }: { saving: boolean; label: string; disabled?: boolean }) {
  return (
    <div className="flex justify-end pt-4 mt-2 border-t border-[var(--color-border)]">
      <button
        type="submit"
        disabled={saving || disabled}
        className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-brand-gold)] px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        {label}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PerfilPage() {
  const { user, setUser } = useUserStore();
  const queryClient = useQueryClient();
  const t = useTranslations('perfil');
  const tc = useTranslations('common');
  const currentLocale = useLocale();
  const router = useRouter();

  const { data: perfilData, isLoading } = useQuery<PerfilResponse>({
    queryKey: ['perfil'],
    queryFn: async () => {
      const res = await fetch('/api/perfil');
      if (!res.ok) throw new Error('Error al cargar perfil');
      return res.json();
    },
    staleTime: 0,
  });

  // ── Form state ────────────────────────────────────────────────────────────
  const [nombre, setNombre] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [telefono, setTelefono] = useState('');
  const [universidad, setUniversidad] = useState('');
  const [añoIngreso, setAñoIngreso] = useState('');
  const [añoEgreso, setAñoEgreso] = useState('');
  const [haDadoExamen, setHaDadoExamen] = useState(false);
  const [intentosPrueba, setIntentosPrueba] = useState('');
  const [duracionClase, setDuracionClase] = useState('60');
  const [cancellationDeadline, setCancellationDeadline] = useState('0');

  // Saved snapshots for dirty detection
  const [savedInfo, setSavedInfo] = useState({
    nombre: '', apellidos: '', telefono: '',
    universidad: '', añoIngreso: '', añoEgreso: '', haDadoExamen: false, intentosPrueba: '',
  });
  const [savedConfig, setSavedConfig] = useState({ duracionClase: '60', cancellationDeadline: '0' });

  // Avatar
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);

  // Password
  const [nuevaPass, setNuevaPass] = useState('');
  const [confirmaPass, setConfirmaPass] = useState('');
  const [showNueva, setShowNueva] = useState(false);
  const [showConfirma, setShowConfirma] = useState(false);

  // Loading states
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (perfilData && !initialized) {
      const initNombre = perfilData.nombre ?? '';
      const initApellidos = getApellidosDisplay(perfilData);
      const initTelefono = perfilData.telefono ?? '';
      const initUniversidad = perfilData.alumno_extra?.universidad ?? '';
      const initAñoIngreso = perfilData.alumno_extra?.año_ingreso ?? '';
      const initAñoEgreso = perfilData.alumno_extra?.año_egreso ?? '';
      const initHaDadoExamen = perfilData.alumno_extra?.ha_dado_examen ?? false;
      const intentos = perfilData.alumno_extra?.intentos_prueba;
      const initIntentosPrueba = intentos != null && intentos > 0 ? String(intentos) : '';
      const initDuracion = String(perfilData.duracion_clase_default_min ?? 60);
      const initDeadline = String(perfilData.cancellation_deadline_hours ?? 0);

      setNombre(initNombre);
      setApellidos(initApellidos);
      setTelefono(initTelefono);
      setUniversidad(initUniversidad);
      setAñoIngreso(initAñoIngreso);
      setAñoEgreso(initAñoEgreso);
      setHaDadoExamen(initHaDadoExamen);
      setIntentosPrueba(initIntentosPrueba);
      setDuracionClase(initDuracion);
      setCancellationDeadline(initDeadline);

      setSavedInfo({ nombre: initNombre, apellidos: initApellidos, telefono: initTelefono, universidad: initUniversidad, añoIngreso: initAñoIngreso, añoEgreso: initAñoEgreso, haDadoExamen: initHaDadoExamen, intentosPrueba: initIntentosPrueba });
      setSavedConfig({ duracionClase: initDuracion, cancellationDeadline: initDeadline });

      setInitialized(true);
    }
  }, [perfilData, initialized]);

  const isAlumno = (perfilData?.rol ?? user?.rol) === 'alumno';
  const isLector = (perfilData?.rol ?? user?.rol) === 'lector';
  const showExtraFields = isAlumno || isLector;

  // ── Dirty detection ───────────────────────────────────────────────────────
  const isDirtyInfo = useMemo(() => {
    if (!initialized) return false;
    const avatarChanged = !!pendingBlob || pendingDelete;
    const fieldsChanged =
      nombre !== savedInfo.nombre ||
      apellidos !== savedInfo.apellidos ||
      (telefono.trim() || null) !== (savedInfo.telefono.trim() || null) ||
      (showExtraFields && universidad !== savedInfo.universidad) ||
      (showExtraFields && añoIngreso !== savedInfo.añoIngreso) ||
      (showExtraFields && añoEgreso !== savedInfo.añoEgreso) ||
      (showExtraFields && haDadoExamen !== savedInfo.haDadoExamen) ||
      (showExtraFields && intentosPrueba !== savedInfo.intentosPrueba);
    return avatarChanged || fieldsChanged;
  }, [initialized, pendingBlob, pendingDelete, nombre, apellidos, telefono, universidad, añoIngreso, añoEgreso, haDadoExamen, intentosPrueba, savedInfo, showExtraFields]);

  const isDirtyConfig = useMemo(() => {
    if (!initialized) return false;
    return duracionClase !== savedConfig.duracionClase || cancellationDeadline !== savedConfig.cancellationDeadline;
  }, [initialized, duracionClase, cancellationDeadline, savedConfig]);

  if (!user) return null;

  const isProfesorOrAdmin = ['profesor', 'admin'].includes(perfilData?.rol ?? user.rol);
  const savedAvatarUrl = initialized ? (perfilData?.avatar_url ?? null) : (user.avatar_url ?? null);
  const currentAvatarUrl = pendingDelete ? null : (previewUrl ?? savedAvatarUrl);
  const hasSavedAvatar = !!savedAvatarUrl;

  // Display name in header: nombre + apellidos from form state
  const displayName = [nombre || user.nombre, apellidos || getApellidosDisplay({ ...user, alumno_extra: null } as PerfilResponse)].filter(Boolean).join(' ');

  // ── Save profile info ─────────────────────────────────────────────────────
  async function handleSaveInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) { toast.error(t('error_nombre')); return; }
    if (!apellidos.trim()) { toast.error(t('error_apellido')); return; }

    // Validación de años en front (evita round-trip innecesario al servidor)
    if (showExtraFields) {
      const rIngreso = validarAño(añoIngreso);
      if (!rIngreso.valido) { toast.error(rIngreso.mensaje); return; }
      const rEgreso = validarAño(añoEgreso);
      if (!rEgreso.valido) { toast.error(rEgreso.mensaje); return; }
    }

    setSavingInfo(true);
    try {
      let avatarUrl: string | null | undefined;

      if (pendingBlob) {
        const supabase = createClient();
        const path = `${user!.id}/avatar.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, pendingBlob, { upsert: true, contentType: 'image/jpeg' });
        if (uploadError) { toast.error(`${t('error_foto_upload')}: ${uploadError.message}`); return; }
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        avatarUrl = urlData.publicUrl;
      } else if (pendingDelete) {
        const supabase = createClient();
        await supabase.storage.from('avatars').remove([`${user!.id}/avatar.jpg`]).catch(() => {});
        avatarUrl = null;
      }

      const intentosPruebaNum = intentosPrueba.trim() ? Number(intentosPrueba.trim()) : null;
      const body: Record<string, unknown> = {
        nombre: nombre.trim(),
        apellidos: apellidos.trim(),
        telefono: telefono.trim() || null,
        ...(showExtraFields && { universidad: universidad.trim() || null }),
        ...(showExtraFields && { año_ingreso: añoIngreso.trim() || null }),
        ...(showExtraFields && { año_egreso: añoEgreso.trim() || null }),
        ...(showExtraFields && { ha_dado_examen: haDadoExamen }),
        ...(showExtraFields && { intentos_prueba: haDadoExamen && intentosPruebaNum ? intentosPruebaNum : null }),
      };
      if (avatarUrl !== undefined) body.avatar_url = avatarUrl;

      const res = await fetch('/api/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? t('error_perfil'));
        return;
      }

      const updated: Profile = await res.json();
      setUser(updated);
      queryClient.invalidateQueries({ queryKey: ['perfil'] });
      // La ficha del alumno (TabInformacion) lee de ['ficha-alumno', id],
      // key distinta a ['perfil']. Invalidarla para evitar datos viejos
      // (ej. teléfono eliminado que persiste hasta que expira staleTime).
      queryClient.invalidateQueries({ queryKey: ['ficha-alumno'] });
      setPendingBlob(null);
      setPreviewUrl(null);
      setPendingDelete(false);
      // Reset dirty snapshot
      setSavedInfo({ nombre: nombre.trim(), apellidos: apellidos.trim(), telefono: telefono.trim(), universidad: universidad.trim(), añoIngreso: añoIngreso.trim(), añoEgreso: añoEgreso.trim(), haDadoExamen, intentosPrueba });
      toast.success(t('exito_perfil'));
    } catch {
      toast.error(t('error_perfil'));
    } finally {
      setSavingInfo(false);
    }
  }

  // ── Save class configuration (profesor/admin only) ───────────────────────
  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await fetch('/api/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duracion_clase_default_min: Number(duracionClase),
          cancellation_deadline_hours: Number(cancellationDeadline),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? t('error_perfil'));
        return;
      }
      const updated: Profile = await res.json();
      setUser(updated);
      queryClient.invalidateQueries({ queryKey: ['perfil'] });
      // Reset dirty snapshot
      setSavedConfig({ duracionClase, cancellationDeadline });
      toast.success(t('exito_perfil'));
    } catch {
      toast.error(t('error_perfil'));
    } finally {
      setSavingConfig(false);
    }
  }

  // ── Change password ───────────────────────────────────────────────────────
  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    if (nuevaPass.length < 8) { toast.error(t('error_password_min')); return; }
    if (nuevaPass !== confirmaPass) { toast.error(t('error_password_match')); return; }

    setSavingPass(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: nuevaPass });
      if (error) { toast.error(`${t('error_password')}: ${error.message}`); return; }
      toast.success(t('exito_password'));
      setNuevaPass('');
      setConfirmaPass('');
    } catch {
      toast.error(t('error_password'));
    } finally {
      setSavingPass(false);
    }
  }

  const passwordTooShort = nuevaPass.length > 0 && nuevaPass.length < 8;
  const passwordMismatch = nuevaPass.length >= 8 && confirmaPass.length > 0 && nuevaPass !== confirmaPass;

  return (
    <div className="space-y-8">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="flex size-9 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-display)' }}>
            {t('titulo')}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{user.email}</p>
        </div>
      </div>

      {isLoading || !initialized ? (
        <div className="flex justify-center py-20">
          <Loader2 className="size-8 animate-spin text-[var(--color-brand-gold)]" />
        </div>
      ) : (
        <div className="space-y-8">

          {/* ── Avatar ─────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-5 pb-8 border-b border-[var(--color-border)]">
            <AvatarUploadSection
              avatarUrl={currentAvatarUrl}
              nombre={nombre || user.nombre}
              apellido={(apellidos || getApellidosDisplay({ ...user, alumno_extra: null } as PerfilResponse)).split(' ')[0]}
              onChange={(blob, pUrl) => { setPendingBlob(blob); setPreviewUrl(pUrl); setPendingDelete(false); }}
              onDelete={() => { setPreviewUrl(null); setPendingBlob(null); setPendingDelete(hasSavedAvatar); }}
              hasSavedAvatar={hasSavedAvatar}
              size="xl"
            />
            <div>
              <p className="text-xl font-semibold text-[var(--color-text-primary)]">{displayName}</p>
              <p className="text-sm text-[var(--color-text-muted)] capitalize mt-0.5">{perfilData?.rol ?? user.rol}</p>
            </div>
          </div>

          {/* ── Información personal ──────────────────────────────────────── */}
          <form onSubmit={handleSaveInfo} className="space-y-6 pb-8 border-b border-[var(--color-border)]">
            <SectionTitle icon={User} title={t('tab_info')} />

            <Field label={t('nombre')}>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder={t('nombre')}
                className={inputCls}
              />
            </Field>

            <Field label={t('apellidos')} hint={t('apellidos_hint')}>
              <input
                type="text"
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                placeholder="García López"
                className={inputCls}
              />
            </Field>

            <Field label={t('telefono')} hint={t('opcional')}>
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="+56 9 1234 5678"
                className={inputCls}
              />
            </Field>

            {showExtraFields && (
              <>
                <Field label={t('universidad')} hint={t('opcional')}>
                  <input
                    type="text"
                    value={universidad}
                    onChange={(e) => setUniversidad(e.target.value)}
                    placeholder="Ej. Universidad de Chile"
                    className={inputCls}
                  />
                </Field>

                <Field label={t('año_ingreso')} hint={t('opcional')}>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={añoIngreso}
                    onChange={(e) => setAñoIngreso(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="Ej. 2023"
                    maxLength={4}
                    className={cn(inputCls, '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none')}
                  />
                  {añoIngreso && !validarAño(añoIngreso).valido && (
                    <p className="mt-1 text-xs text-[var(--color-error)]">{validarAño(añoIngreso).mensaje}</p>
                  )}
                </Field>

                <Field label={t('año_egreso')} hint={t('opcional')}>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={añoEgreso}
                    onChange={(e) => setAñoEgreso(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="Ej. 2027"
                    maxLength={4}
                    className={cn(inputCls, '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none')}
                  />
                  {añoEgreso && !validarAño(añoEgreso).valido && (
                    <p className="mt-1 text-xs text-[var(--color-error)]">{validarAño(añoEgreso).mensaje}</p>
                  )}
                </Field>

                <Field label={t('ha_dado_examen')} hint={t('ha_dado_examen_desc')}>
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => { const next = !haDadoExamen; setHaDadoExamen(next); if (!next) setIntentosPrueba(''); }}
                      className="flex items-center gap-3"
                      role="checkbox"
                      aria-checked={haDadoExamen}
                    >
                      <div className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border-2 transition-all',
                        haDadoExamen
                          ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold)]'
                          : 'border-[var(--color-border-strong)] bg-[var(--color-bg)]',
                      )}>
                        {haDadoExamen && (
                          <svg className="size-3 text-white" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm text-[var(--color-text-primary)]">{t('ha_dado_examen')}</span>
                    </button>

                    <div className={cn(
                      'grid transition-all duration-300',
                      haDadoExamen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                    )}>
                      <div className="overflow-hidden">
                        <div className="pt-1 space-y-1.5">
                          <label className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
                            <ClipboardCheck className="size-4 text-[var(--color-brand-gold)]" />
                            {t('veces_dado')} <span className="font-normal text-[var(--color-text-muted)]">{t('opcional')}</span>
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={intentosPrueba}
                            onChange={(e) => setIntentosPrueba(e.target.value.replace(/\D/g, '').slice(0, 2))}
                            placeholder={t('veces_dado_placeholder')}
                            maxLength={2}
                            className={inputCls}
                            tabIndex={haDadoExamen ? 0 : -1}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </Field>
              </>
            )}

            <SaveBar saving={savingInfo} label={savingInfo ? tc('cargando') : t('guardar')} disabled={!isDirtyInfo} />
          </form>

          {/* ── Configuración de clases (solo profesor/admin) ─────────────── */}
          {isProfesorOrAdmin && (
            <form onSubmit={handleSaveConfig} className="space-y-6 pb-8 border-b border-[var(--color-border)]">
              <SectionTitle icon={Settings2} title={t('configuracion_clases')} />

              <Field label={t('duracion_clase')} hint={t('duracion_clase_hint')} inline>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={15}
                    max={480}
                    step={15}
                    value={duracionClase}
                    onChange={(e) => setDuracionClase(e.target.value)}
                    className={cn(inputCls, 'w-28')}
                  />
                  <span className="text-sm text-[var(--color-text-muted)]">{t('minutos')}</span>
                </div>
              </Field>

              <Field label={t('cancellation_deadline')} hint={t('cancellation_deadline_hint')} inline>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={168}
                    step={1}
                    value={cancellationDeadline}
                    onChange={(e) => setCancellationDeadline(e.target.value)}
                    className={cn(inputCls, 'w-28')}
                  />
                  <span className="text-sm text-[var(--color-text-muted)]">{t('horas')}</span>
                </div>
              </Field>

              <SaveBar saving={savingConfig} label={savingConfig ? tc('cargando') : t('guardar')} disabled={!isDirtyConfig} />
            </form>
          )}

          {/* ── Preferencias ─────────────────────────────────────────────── */}
          <div className="space-y-6 pb-8 border-b border-[var(--color-border)]">
            <SectionTitle icon={Globe} title={t('preferencias')} />
            <Field label={t('idioma')}>
              {/* LanguageSelector already does optimistic update:
                  sets cookie + router.refresh() immediately, then persists to DB debounced */}
              <LanguageSelector
                currentLocale={currentLocale}
                onLocaleChange={(locale) => {
                  // Fire-and-forget — no await, UI already updated by LanguageSelector
                  fetch('/api/perfil', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ idioma: locale }),
                  }).catch(() => {});
                }}
              />
            </Field>
          </div>

          {/* ── Seguridad ────────────────────────────────────────────────── */}
          <form onSubmit={handleSavePassword} className="space-y-6">
            <SectionTitle icon={Lock} title={t('tab_seguridad')} />

            <Field label={t('nueva_password')}>
              <div className="relative">
                <input
                  type={showNueva ? 'text' : 'password'}
                  value={nuevaPass}
                  onChange={(e) => setNuevaPass(e.target.value)}
                  placeholder={t('password_min')}
                  autoComplete="new-password"
                  className={cn(inputCls, 'pr-10')}
                />
                <button
                  type="button"
                  onClick={() => setShowNueva((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                >
                  {showNueva ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>

            <Field label={t('confirmar_password')}>
              <div className="relative">
                <input
                  type={showConfirma ? 'text' : 'password'}
                  value={confirmaPass}
                  onChange={(e) => setConfirmaPass(e.target.value)}
                  autoComplete="new-password"
                  className={cn(inputCls, 'pr-10')}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirma((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                >
                  {showConfirma ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {passwordTooShort && (
                <p className="text-xs text-[var(--color-error)] mt-1.5">{t('password_hint', { actual: nuevaPass.length })}</p>
              )}
              {passwordMismatch && (
                <p className="text-xs text-[var(--color-error)] mt-1.5">{t('password_no_coincide')}</p>
              )}
            </Field>

            <SaveBar
              saving={savingPass}
              label={savingPass ? tc('cargando') : t('cambiar_password')}
              disabled={nuevaPass.length < 8 || nuevaPass !== confirmaPass}
            />
          </form>

        </div>
      )}
    </div>
  );
}
