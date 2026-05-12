'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/stores/useUserStore';
import { Modal } from '@/components/common/Modal';
import { cn } from '@/lib/utils';
import type { Profile, AlumnoExtra } from '@/lib/supabase/types';

import { AvatarUploadSection } from './components/AvatarUploadSection';
import { TabInfoPersonal } from './components/TabInfoPersonal';
import { TabSeguridad } from './components/TabSeguridad';
import type { InfoFormData } from './components/TabInfoPersonal';

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

// ─── Component ────────────────────────────────────────────────────────────────

export function EditarPerfilModal({ open, onClose }: EditarPerfilModalProps) {
  const { user, setUser } = useUserStore();
  const queryClient = useQueryClient();
  const t = useTranslations('perfil');
  const currentLocale = useLocale();

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

  // ── Security tab state ────────────────────────────────────────────────────
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

  // ── Avatar handlers ───────────────────────────────────────────────────────
  function handleAvatarChange(blob: Blob, pUrl: string) {
    setPendingBlob(blob);
    setPreviewUrl(pUrl);
    setPendingDelete(false);
    setProcessingImg(false);
  }

  function handleAvatarDelete() {
    setPreviewUrl(null);
    setPendingBlob(null);
    setPendingDelete(hasSavedAvatar);
  }

  // ── Save profile ──────────────────────────────────────────────────────────
  async function handleSaveInfo(data: InfoFormData) {
    if (!user) return;
    if (!data.nombre.trim()) { toast.error(t('error_nombre')); return; }
    if (!data.apellidos.trim()) { toast.error(t('error_apellido')); return; }

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
        await supabase.storage.from('avatars').remove([`${user.id}/avatar.jpg`]).catch(() => {});
        avatarUrl = null;
      }

      const isAlumno = (perfilData?.rol ?? user.rol) === 'alumno';
      const intentosPruebaNum = data.intentosPrueba.trim() ? Number(data.intentosPrueba.trim()) : null;
      const body: Record<string, unknown> = {
        nombre: data.nombre.trim(),
        apellidos: data.apellidos.trim(),
        telefono: data.telefono.trim() || null,
        ...(isAlumno && { universidad: data.universidad.trim() || null }),
        ...(isAlumno && { año_ingreso: data.añoIngreso.trim() || null }),
        ...(isAlumno && { ha_dado_examen: data.haDadoExamen }),
        ...(isAlumno && { intentos_prueba: data.haDadoExamen && intentosPruebaNum ? intentosPruebaNum : null }),
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
  async function handleSavePassword(password: string) {
    if (password.length < 8) { toast.error(t('error_password_min')); return; }

    setSavingPass(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { toast.error(`${t('error_password')}: ${error.message}`); return; }
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
  const savedAvatarUrl = initialized ? (perfilData?.avatar_url ?? null) : user.avatar_url ?? null;
  const currentAvatarUrl = pendingDelete ? null : (previewUrl ?? savedAvatarUrl);
  const hasSavedAvatar = !!savedAvatarUrl;
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
          <TabInfoPersonal
            perfilData={perfilData ?? null}
            isAlumno={isAlumno}
            initialized={initialized && !loadingPerfil}
            onSave={handleSaveInfo}
            saving={savingInfo}
            processingImg={processingImg}
            avatarSection={
              <AvatarUploadSection
                avatarUrl={currentAvatarUrl}
                nombre={avatarNombre}
                apellido={avatarApellido}
                onChange={handleAvatarChange}
                onDelete={handleAvatarDelete}
                hasSavedAvatar={hasSavedAvatar}
                processing={processingImg}
              />
            }
            nombre={nombre}
            setNombre={setNombre}
            apellidos={apellidos}
            setApellidos={setApellidos}
            telefono={telefono}
            setTelefono={setTelefono}
            universidad={universidad}
            setUniversidad={setUniversidad}
            añoIngreso={añoIngreso}
            setAñoIngreso={setAñoIngreso}
            haDadoExamen={haDadoExamen}
            setHaDadoExamen={setHaDadoExamen}
            intentosPrueba={intentosPrueba}
            setIntentosPrueba={setIntentosPrueba}
          />
        </div>

        {/* ── Security Tab ───────────────────────────────────────────────── */}
        <div
          className={cn(
            'col-start-1 row-start-1 space-y-5',
            activeTab !== 'seguridad' && 'invisible pointer-events-none select-none',
          )}
          aria-hidden={activeTab !== 'seguridad' ? true : undefined}
        >
          <TabSeguridad
            currentLocale={currentLocale}
            onSavePassword={handleSavePassword}
            saving={savingPass}
          />
        </div>

      </div>
    </Modal>
  );
}
