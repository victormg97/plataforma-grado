'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useUserStore } from '@/stores/useUserStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save, Upload, User } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { tenantConfig } from '@/config';
import type { LandingSobreNosotrasConfig } from '@/lib/supabase/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert any image file to WebP using canvas.
 * Maintains quality while reducing file size.
 */
async function convertToWebP(file: File, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas context not available'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob) resolve(blob);
          else reject(new Error('WebP conversion failed'));
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };

    img.src = url;
  });
}

function getPublicUrl(path: string): string {
  const supabase = createClient();
  const { data } = supabase.storage.from('content').getPublicUrl(path);
  return data.publicUrl;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PersonaCard({
  number,
  prefijo,
  nombre,
  imagePath,
  onPrefijoChange,
  onNombreChange,
  onImageUploaded,
  t,
}: {
  number: 1 | 2;
  prefijo: string;
  nombre: string;
  imagePath: string | null;
  onPrefijoChange: (v: string) => void;
  onNombreChange: (v: string) => void;
  onImageUploaded: (path: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const imageUrl = localPreview ?? (imagePath ? getPublicUrl(imagePath) : null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_MIME.includes(file.type)) {
      toast.error(t('imagen_error_tipo'));
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error(t('imagen_error_tamano'));
      return;
    }

    setUploading(true);
    try {
      // Convert to WebP
      setConverting(true);
      const webpBlob = await convertToWebP(file);
      setConverting(false);

      // Upload to Supabase Storage
      const supabase = createClient();
      const storagePath = `tenants/${tenantConfig.id}/sobre-nosotras-${number}.webp`;

      const { error } = await supabase.storage
        .from('content')
        .upload(storagePath, webpBlob, {
          upsert: true,
          contentType: 'image/webp',
        });

      if (error) throw error;

      // Set local preview and notify parent
      setLocalPreview(URL.createObjectURL(webpBlob));
      onImageUploaded(storagePath);
      toast.success(t('imagen_subida'));
    } catch {
      toast.error(t('imagen_error'));
    } finally {
      setUploading(false);
      setConverting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-5 space-y-5">
      <h4 className="text-sm font-bold text-[var(--color-brand-gold)]">
        {t('persona', { number })}
      </h4>

      <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
        {/* Name fields */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">
              {t('prefijo')}
            </label>
            <input
              type="text"
              value={prefijo}
              onChange={(e) => onPrefijoChange(e.target.value)}
              placeholder={t('prefijo_placeholder')}
              className={cn(
                'mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]',
                'px-3 py-2.5 text-sm text-[var(--color-text-primary)]',
                'focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]'
              )}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">
              {t('nombre')}
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => onNombreChange(e.target.value)}
              placeholder={t('nombre_placeholder')}
              className={cn(
                'mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]',
                'px-3 py-2.5 text-sm text-[var(--color-text-primary)]',
                'focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]'
              )}
            />
          </div>
        </div>

        {/* Image preview + upload */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-32 w-28 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={`${prefijo} ${nombre}`}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <User className="size-10 text-[var(--color-text-muted)] opacity-40" />
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={cn(
              'flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-medium transition-colors',
              'border border-[var(--color-border)] text-[var(--color-text-secondary)]',
              'hover:border-[var(--color-brand-gold)] hover:text-[var(--color-brand-gold)]',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {uploading ? (
              <>
                <Loader2 className="size-3 animate-spin" />
                {converting ? t('convirtiendo') : '...'}
              </>
            ) : (
              <>
                <Upload className="size-3" />
                {imageUrl ? t('imagen_cambiar') : t('imagen_subir')}
              </>
            )}
          </button>

          <p className="text-center text-[10px] leading-tight text-[var(--color-text-muted)]">
            {t('imagen_formatos')}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SobreNosotrasImagenesPage() {
  const { user } = useUserStore();
  const router = useRouter();
  const t = useTranslations('sobreNosotrasConfig');
  const queryClient = useQueryClient();
  const supabase = createClient();

  const [form, setForm] = useState<{
    persona1_prefijo: string;
    persona1_nombre: string;
    persona1_image_path: string | null;
    persona2_prefijo: string;
    persona2_nombre: string;
    persona2_image_path: string | null;
  } | null>(null);

  // Guard: solo admins
  useEffect(() => {
    if (user && user.rol !== 'admin') {
      router.replace('/perfil');
    }
  }, [user, router]);

  // Fetch config
  const { data: config, isLoading } = useQuery({
    queryKey: ['admin-sobre-nosotras-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('landing_sobre_nosotras_config')
        .select('*')
        .eq('tenant_slug', tenantConfig.id)
        .single();
      if (error) throw error;
      return data as LandingSobreNosotrasConfig;
    },
    staleTime: 60_000,
    enabled: !!user && user.rol === 'admin',
  });

  // Derive effective form state
  const effectiveForm = form ?? (config ? {
    persona1_prefijo: config.persona1_prefijo,
    persona1_nombre: config.persona1_nombre,
    persona1_image_path: config.persona1_image_path,
    persona2_prefijo: config.persona2_prefijo,
    persona2_nombre: config.persona2_nombre,
    persona2_image_path: config.persona2_image_path,
  } : null);

  // Save names mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof effectiveForm) => {
      if (!data) throw new Error('No data');
      const { error } = await supabase
        .from('landing_sobre_nosotras_config')
        .update({
          persona1_prefijo: data.persona1_prefijo,
          persona1_nombre: data.persona1_nombre,
          persona1_image_path: data.persona1_image_path,
          persona2_prefijo: data.persona2_prefijo,
          persona2_nombre: data.persona2_nombre,
          persona2_image_path: data.persona2_image_path,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_slug', tenantConfig.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(t('nombres_guardados'));
      queryClient.invalidateQueries({ queryKey: ['admin-sobre-nosotras-config'] });
      queryClient.invalidateQueries({ queryKey: ['landing-sobre-nosotras-config'] });
      // Revalidate landing page
      await fetch('/api/landing/planes/revalidate', { method: 'POST' });
    },
    onError: () => {
      toast.error(t('nombres_error'));
    },
  });

  if (!user || user.rol !== 'admin') return null;

  if (isLoading || !effectiveForm) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-[var(--color-brand-gold)]" />
      </div>
    );
  }

  const update = (key: string, value: string | null) => {
    setForm((prev) => {
      const base = prev ?? (config ? {
        persona1_prefijo: config.persona1_prefijo,
        persona1_nombre: config.persona1_nombre,
        persona1_image_path: config.persona1_image_path,
        persona2_prefijo: config.persona2_prefijo,
        persona2_nombre: config.persona2_nombre,
        persona2_image_path: config.persona2_image_path,
      } : null);
      return base ? { ...base, [key]: value } : null;
    });
  };

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex items-start gap-4">
        <Link
          href="/pagina"
          className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] hover:border-[var(--color-brand-gold)] transition-colors"
        >
          <ArrowLeft className="size-4 text-[var(--color-text-muted)]" />
        </Link>
        <div>
          <h1
            className="text-2xl font-bold text-[var(--color-text-primary)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t('titulo')}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 leading-relaxed">
            {t('subtitulo')}
          </p>
        </div>
      </div>

      {/* ── Persona 1 ── */}
      <PersonaCard
        number={1}
        prefijo={effectiveForm.persona1_prefijo}
        nombre={effectiveForm.persona1_nombre}
        imagePath={effectiveForm.persona1_image_path}
        onPrefijoChange={(v) => update('persona1_prefijo', v)}
        onNombreChange={(v) => update('persona1_nombre', v)}
        onImageUploaded={(path) => update('persona1_image_path', path)}
        t={t}
      />

      {/* ── Persona 2 ── */}
      <PersonaCard
        number={2}
        prefijo={effectiveForm.persona2_prefijo}
        nombre={effectiveForm.persona2_nombre}
        imagePath={effectiveForm.persona2_image_path}
        onPrefijoChange={(v) => update('persona2_prefijo', v)}
        onNombreChange={(v) => update('persona2_nombre', v)}
        onImageUploaded={(path) => update('persona2_image_path', path)}
        t={t}
      />

      {/* ── Save button ── */}
      <div className="sticky bottom-4 flex justify-end">
        <button
          type="button"
          onClick={() => effectiveForm && saveMutation.mutate(effectiveForm)}
          disabled={saveMutation.isPending}
          className={cn(
            'flex items-center gap-2 rounded-[var(--radius-lg)] px-6 py-3 text-sm font-semibold text-white shadow-md transition-all',
            'bg-[var(--color-brand-gold)] hover:opacity-90',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {saveMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {saveMutation.isPending ? t('guardando_nombres') : t('guardar_nombres')}
        </button>
      </div>
    </div>
  );
}
