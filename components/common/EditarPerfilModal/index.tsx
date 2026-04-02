'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Loader2, Eye, EyeOff, ImagePlus, Trash2 } from 'lucide-react';
import { useLocale } from 'next-intl';
import { LanguageSelector } from '@/components/common/LanguageSelector';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUserStore } from '@/stores/useUserStore';
import { Modal } from '@/components/common/Modal';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { cn } from '@/lib/utils';
import type { Profile, AlumnoExtra } from '@/lib/supabase/types';
import { ClipboardCheck } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type PerfilResponse = Profile & {
  alumno_extra: Pick<AlumnoExtra, 'universidad' | 'año_ingreso' | 'ha_dado_examen' | 'intentos_prueba'> | null;
};

interface EditarPerfilModalProps {
  open: boolean;
  onClose: () => void;
}

type ActiveTab = 'info' | 'seguridad';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getApellidosDisplay(profile: PerfilResponse | Profile): string {
  const apellidoMaterno = 'apellido_materno' in profile ? profile.apellido_materno : null;
  return [profile.apellido, apellidoMaterno].filter(Boolean).join(' ');
}

/**
 * Converts any browser-decodable image (JPEG, PNG, WEBP, GIF, HEIC on iOS Safari)
 * to a JPEG Blob at max 1200px, quality 85%.
 * iOS Safari can render HEIC natively via Image(), so no extra lib is needed.
 */
function normalizeToJpeg(file: File): Promise<{ blob: Blob; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const MAX_PX = 1200;
      let w = img.naturalWidth;
      let h = img.naturalHeight;

      if (w > MAX_PX || h > MAX_PX) {
        if (w >= h) { h = Math.round((h * MAX_PX) / w); w = MAX_PX; }
        else { w = Math.round((w * MAX_PX) / h); h = MAX_PX; }
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }

      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Canvas export failed')); return; }
          resolve({ blob, previewUrl: URL.createObjectURL(blob) });
        },
        'image/jpeg',
        0.85,
      );
    };

    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')); };
    img.src = objectUrl;
  });
}

// ─── Shared input class ───────────────────────────────────────────────────────

const inputCls = cn(
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)]',
  'bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]',
  'placeholder:text-[var(--color-text-muted)]',
  'focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]',
  'transition-colors',
);

// ─── Component ────────────────────────────────────────────────────────────────

export function EditarPerfilModal({ open, onClose }: EditarPerfilModalProps) {
  const { user, setUser } = useUserStore();
  const queryClient = useQueryClient();
  const t = useTranslations('perfil');
  const tc = useTranslations('common');

  const [activeTab, setActiveTab] = useState<ActiveTab>('info');

  // ── React Query: always fetch fresh when modal opens ──────────────────────
  const { data: perfilData, isLoading: loadingPerfil } = useQuery<PerfilResponse>({
    queryKey: ['perfil'],
    queryFn: async () => {
      const res = await fetch('/api/perfil');
      if (!res.ok) throw new Error('Error al cargar perfil');
      return res.json();
    },
    enabled: open,
    staleTime: 0,
    refetchOnMount: true,
  });

  // ── Info tab state ────────────────────────────────────────────────────────
  const [nombre, setNombre] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [telefono, setTelefono] = useState('');
  const [universidad, setUniversidad] = useState('');
  const [añoIngreso, setAñoIngreso] = useState('');
  const [haDadoExamen, setHaDadoExamen] = useState(false);
  const [intentosPrueba, setIntentosPrueba] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [processingImg, setProcessingImg] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Language/locale state ─────────────────────────────────────────────────
  const currentLocale = useLocale();

  // ── Security tab state ────────────────────────────────────────────────────
  const [nuevaPass, setNuevaPass] = useState('');
  const [confirmaPass, setConfirmaPass] = useState('');
  const [showNueva, setShowNueva] = useState(false);
  const [showConfirma, setShowConfirma] = useState(false);
  const [savingPass, setSavingPass] = useState(false);

  // ── Initialize form once per open session ─────────────────────────────────
  const [initialized, setInitialized] = useState(false);

  // Reset everything when modal closes
  useEffect(() => {
    if (!open) {
      setInitialized(false);
      setPreviewUrl(null);
      setPendingBlob(null);
      setPendingDelete(false);
      setNuevaPass('');
      setConfirmaPass('');
      setShowNueva(false);
      setShowConfirma(false);
      setActiveTab('info');
      setHaDadoExamen(false);
      setIntentosPrueba('');
    }
  }, [open]);

  // Pre-fill fields once data arrives (only once per open session)
  useEffect(() => {
    if (perfilData && !initialized) {
      setNombre(perfilData.nombre ?? '');
      setApellidos(getApellidosDisplay(perfilData));
      setTelefono(perfilData.telefono ?? '');
      setUniversidad(perfilData.alumno_extra?.universidad ?? '');
      setAñoIngreso(perfilData.alumno_extra?.año_ingreso ?? '');
      const haDado = perfilData.alumno_extra?.ha_dado_examen ?? false;
      const intentos = perfilData.alumno_extra?.intentos_prueba;
      setHaDadoExamen(haDado);
      setIntentosPrueba(intentos != null && intentos > 0 ? String(intentos) : '');
      setInitialized(true);
    }
  }, [perfilData, initialized]);

  // ── Image handling ────────────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 10 MB raw limit (canvas will compress it down)
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('error_foto_tamaño'));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setProcessingImg(true);
    try {
      const { blob, previewUrl: pUrl } = await normalizeToJpeg(file);
      setPendingBlob(blob);
      setPreviewUrl(pUrl);
      setPendingDelete(false); // new upload cancels a pending deletion
    } catch {
      toast.error(t('error_foto_tipo'));
    } finally {
      setProcessingImg(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // ── Save profile ──────────────────────────────────────────────────────────
  async function handleSaveInfo() {
    if (!user) return;
    if (!nombre.trim()) { toast.error(t('error_nombre')); return; }
    if (!apellidos.trim()) { toast.error(t('error_apellido')); return; }

    setSavingInfo(true);
    try {
      let avatarUrl: string | null | undefined;

      if (pendingBlob) {
        const supabase = createClient();
        const path = `${user.id}/avatar.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, pendingBlob, { upsert: true, contentType: 'image/jpeg' });

        if (uploadError) {
          toast.error(`${t('error_foto_upload')}: ${uploadError.message}`);
          setSavingInfo(false);
          return;
        }

        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        avatarUrl = urlData.publicUrl;
      } else if (pendingDelete) {
        const supabase = createClient();
        // Ignore storage deletion errors (file might not exist)
        await supabase.storage.from('avatars').remove([`${user.id}/avatar.jpg`]).catch(() => {});
        avatarUrl = null;
      }

      const isAlumno = (perfilData?.rol ?? user.rol) === 'alumno';
      const intentosPruebaNum = intentosPrueba.trim() ? Number(intentosPrueba.trim()) : null;
      const body: Record<string, unknown> = {
        nombre: nombre.trim(),
        apellidos: apellidos.trim(),
        telefono: telefono.trim() || null,
        ...(isAlumno && { universidad: universidad.trim() || null }),
        ...(isAlumno && { año_ingreso: añoIngreso.trim() || null }),
        ...(isAlumno && { ha_dado_examen: haDadoExamen }),
        ...(isAlumno && { intentos_prueba: haDadoExamen && intentosPruebaNum ? intentosPruebaNum : null }),
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
      setPendingBlob(null);
      setPreviewUrl(null);
      setPendingDelete(false);
      toast.success(t('exito_perfil'));
      onClose();
    } catch {
      toast.error(t('error_perfil'));
    } finally {
      setSavingInfo(false);
    }
  }

  // ── Change password ───────────────────────────────────────────────────────
  async function handleSavePassword() {
    if (nuevaPass.length < 8) { toast.error(t('error_password_min')); return; }
    if (nuevaPass !== confirmaPass) { toast.error(t('error_password_match')); return; }

    setSavingPass(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: nuevaPass });
      if (error) { toast.error(`${t('error_password')}: ${error.message}`); return; }
      setNuevaPass('');
      setConfirmaPass('');
      toast.success(t('exito_password'));
      onClose();
    } catch {
      toast.error(t('error_password'));
    } finally {
      setSavingPass(false);
    }
  }

  if (!user) return null;

  const isAlumno = (perfilData?.rol ?? user.rol) === 'alumno';
  // Avatar src: pending delete → null; new preview → previewUrl; otherwise DB/store value
  const savedAvatarUrl = initialized ? (perfilData?.avatar_url ?? null) : user.avatar_url ?? null;
  const currentAvatarUrl = pendingDelete ? null : (previewUrl ?? savedAvatarUrl);
  const hasSavedAvatar = !!savedAvatarUrl;
  // Avatar display name while form state isn't ready yet
  const avatarNombre = initialized ? nombre : user.nombre;
  const avatarApellido = initialized ? apellidos.split(' ')[0] : user.apellido;

  return (
    <Modal open={open} onClose={onClose} title={t('titulo')}>
      {/* Tabs */}
      <div className="flex gap-1 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-1 mb-6">
        {(['info', 'seguridad'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === tab
                ? 'bg-[var(--color-bg)] text-[var(--color-text-primary)] shadow-[var(--shadow-sm)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
            )}
          >
            {tab === 'info' ? t('tab_info') : t('tab_seguridad')}
          </button>
        ))}
      </div>

      {/* Both tab panels live in the same grid cell so the modal height is
          always dictated by the tallest panel (Info). The inactive panel is
          visually hidden and removed from pointer/keyboard interaction. */}
      <div className="grid">

        {/* ── Info Tab ───────────────────────────────────────────────────── */}
        <div
          className={cn(
            'col-start-1 row-start-1 space-y-5',
            activeTab !== 'info' && 'invisible pointer-events-none select-none',
          )}
          aria-hidden={activeTab !== 'info' ? true : undefined}
        >
          {loadingPerfil && !initialized ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--color-brand-gold)]" />
            </div>
          ) : (
            <>
              {/* Avatar upload */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <Avatar
                    nombre={avatarNombre}
                    apellido={avatarApellido}
                    avatarUrl={currentAvatarUrl}
                    size="lg"
                  />

                  {/* Camera button opens dropdown with photo options */}
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      disabled={processingImg}
                      className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-brand-gold)] text-white shadow-[var(--shadow-sm)] transition-opacity hover:opacity-90 disabled:opacity-60"
                      aria-label={t('foto_aria')}
                    >
                      {processingImg
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Camera className="h-3.5 w-3.5" />
                      }
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      side="bottom"
                      align="center"
                      className="min-w-[11rem] border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-md)]"
                    >
                      <DropdownMenuItem
                        onClick={() => fileInputRef.current?.click()}
                        className="cursor-pointer gap-2 text-[var(--color-text-primary)]"
                      >
                        <ImagePlus className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                        {t('foto_cargar')}
                      </DropdownMenuItem>

                      {(currentAvatarUrl !== null || pendingBlob !== null) && !pendingDelete && (
                        <>
                          <DropdownMenuSeparator className="border-[var(--color-border)]" />
                          <DropdownMenuItem
                            onClick={() => {
                              setPreviewUrl(null);
                              setPendingBlob(null);
                              setPendingDelete(hasSavedAvatar);
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className="cursor-pointer gap-2 text-[var(--color-error)] focus:text-[var(--color-error)]"
                          >
                            <Trash2 className="h-4 w-4 shrink-0" />
                            {t('foto_eliminar')}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">{t('foto_hint')}</p>
              </div>

              {/* Nombre */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[var(--color-text-primary)]">
                  {t('nombre')}
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder={t('nombre')}
                  className={inputCls}
                />
              </div>

              {/* Apellidos (combined) */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[var(--color-text-primary)]">
                  {t('apellidos')}
                </label>
                <input
                  type="text"
                  value={apellidos}
                  onChange={(e) => setApellidos(e.target.value)}
                  placeholder="García López"
                  className={inputCls}
                />
                <p className="text-xs text-[var(--color-text-muted)]">{t('apellidos_hint')}</p>
              </div>

              {/* Teléfono */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[var(--color-text-primary)]">
                  {t('telefono')}{' '}
                  <span className="font-normal text-[var(--color-text-muted)]">{t('opcional')}</span>
                </label>
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="+56 9 1234 5678"
                  className={inputCls}
                />
              </div>

              {/* Alumno-only fields */}
              {isAlumno && (
                <>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-[var(--color-text-primary)]">
                      {t('universidad')}{' '}
                      <span className="font-normal text-[var(--color-text-muted)]">{t('opcional')}</span>
                    </label>
                    <input
                      type="text"
                      value={universidad}
                      onChange={(e) => setUniversidad(e.target.value)}
                      placeholder="Ej. Universidad de Chile"
                      className={inputCls}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-[var(--color-text-primary)]">
                      {t('año_ingreso')}{' '}
                      <span className="font-normal text-[var(--color-text-muted)]">{t('opcional')}</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={añoIngreso}
                      onChange={(e) => setAñoIngreso(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="Ej. 2023"
                      maxLength={4}
                      className={inputCls}
                    />
                  </div>

                  {/* ── Examen de grado ── */}
                  <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4 space-y-3">
                    {/* Checkbox row */}
                    <button
                      type="button"
                      onClick={() => {
                        setHaDadoExamen((v) => !v);
                        if (haDadoExamen) setIntentosPrueba('');
                      }}
                      className="flex w-full items-start gap-3 text-left"
                      aria-checked={haDadoExamen}
                      role="checkbox"
                    >
                      {/* Custom toggle box */}
                      <div
                        className={cn(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border-2 transition-all duration-200',
                          haDadoExamen
                            ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold)]'
                            : 'border-[var(--color-border-strong)] bg-[var(--color-bg)]',
                        )}
                      >
                        {haDadoExamen && (
                          <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text-primary)] leading-snug">
                          {t('ha_dado_examen')}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          {t('ha_dado_examen_desc')}
                        </p>
                      </div>
                    </button>

                    {/* Animated count field */}
                    <div
                      className={cn(
                        'grid transition-all duration-300 ease-in-out',
                        haDadoExamen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                      )}
                    >
                      <div className="overflow-hidden">
                        <div className="pt-1 space-y-1.5">
                          <label className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-primary)]">
                            <ClipboardCheck className="h-4 w-4 text-[var(--color-brand-gold)]" />
                            {t('veces_dado')}{' '}
                            <span className="font-normal text-[var(--color-text-muted)]">{t('opcional')}</span>
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
                </>
              )}

              <Button
                variant="primary"
                fullWidth
                loading={savingInfo}
                onClick={handleSaveInfo}
                disabled={savingInfo || processingImg}
              >
                {savingInfo ? tc('cargando') : t('guardar')}
              </Button>
            </>
          )}
        </div>

        {/* ── Security Tab ───────────────────────────────────────────────── */}
        <div
          className={cn(
            'col-start-1 row-start-1 space-y-5',
            activeTab !== 'seguridad' && 'invisible pointer-events-none select-none',
          )}
          aria-hidden={activeTab !== 'seguridad' ? true : undefined}
        >
          {/* Idioma */}
          <LanguageSelector
            currentLocale={currentLocale}
            onLocaleChange={async (locale) => {
              // Persist language preference to DB
              await fetch('/api/perfil', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idioma: locale }),
              });
            }}
          />

          {/* Nueva contraseña */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--color-text-primary)]">
              {t('nueva_password')}
            </label>
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
                aria-label={showNueva ? 'Ocultar' : 'Mostrar'}
              >
                {showNueva ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirmar contraseña */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--color-text-primary)]">
              {t('confirmar_password')}
            </label>
            <div className="relative">
              <input
                type={showConfirma ? 'text' : 'password'}
                value={confirmaPass}
                onChange={(e) => setConfirmaPass(e.target.value)}
                autoComplete="new-password"
                className={cn(inputCls, 'pr-10')}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSavePassword(); }}
              />
              <button
                type="button"
                onClick={() => setShowConfirma((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                aria-label={showConfirma ? 'Ocultar' : 'Mostrar'}
              >
                {showConfirma ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {nuevaPass.length > 0 && nuevaPass.length < 8 && (
            <p className="text-xs text-[var(--color-error)]">
              {t('password_hint', { actual: nuevaPass.length })}
            </p>
          )}
          {nuevaPass.length >= 8 && confirmaPass.length > 0 && nuevaPass !== confirmaPass && (
            <p className="text-xs text-[var(--color-error)]">{t('password_no_coincide')}</p>
          )}

          <Button
            variant="primary"
            fullWidth
            loading={savingPass}
            onClick={handleSavePassword}
            disabled={savingPass}
          >
            {savingPass ? tc('cargando') : t('cambiar_password')}
          </Button>
        </div>

      </div>
    </Modal>
  );
}

