'use client';

import { useRef, useState } from 'react';
import { Camera, Loader2, ImagePlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar } from '@/components/common/Avatar';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Converts any browser-decodable image (JPEG, PNG, WEBP, GIF, HEIC on iOS Safari)
 * to a JPEG Blob at max 1200px, quality 85%.
 * iOS Safari can render HEIC natively via Image(), so no extra lib is needed.
 */
export function normalizeToJpeg(file: File): Promise<{ blob: Blob; previewUrl: string }> {
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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AvatarUploadSectionProps {
  /** Current avatar URL to display (null = show initials) */
  avatarUrl: string | null;
  /** Display name for initials fallback */
  nombre: string;
  /** Display surname for initials fallback */
  apellido: string;
  /** Called with the normalized JPEG Blob when user selects a new image */
  onChange: (blob: Blob, previewUrl: string) => void;
  /** Called when user requests avatar deletion */
  onDelete: () => void;
  /** Whether a saved avatar exists (controls delete option visibility) */
  hasSavedAvatar: boolean;
  /** Whether image processing is in progress */
  processing?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AvatarUploadSection({
  avatarUrl,
  nombre,
  apellido,
  onChange,
  onDelete,
  hasSavedAvatar,
  processing: externalProcessing,
}: AvatarUploadSectionProps) {
  const t = useTranslations('perfil');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [internalProcessing, setInternalProcessing] = useState(false);

  const processing = externalProcessing ?? internalProcessing;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 10 MB raw limit (canvas will compress it down)
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('error_foto_tamaño'));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setInternalProcessing(true);
    try {
      const { blob, previewUrl } = await normalizeToJpeg(file);
      onChange(blob, previewUrl);
    } catch {
      toast.error(t('error_foto_tipo'));
    } finally {
      setInternalProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const showDeleteOption = (avatarUrl !== null || hasSavedAvatar);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <Avatar
          nombre={nombre}
          apellido={apellido}
          avatarUrl={avatarUrl}
          size="lg"
        />

        {/* Camera button opens dropdown with photo options */}
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={processing}
            className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full bg-[var(--color-brand-gold)] text-white shadow-[var(--shadow-sm)] transition-opacity hover:opacity-90 disabled:opacity-60"
            aria-label={t('foto_aria')}
          >
            {processing
              ? <Loader2 className="size-3.5 animate-spin" />
              : <Camera className="size-3.5" />
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
              <ImagePlus className="size-4 shrink-0 text-[var(--color-text-muted)]" />
              {t('foto_cargar')}
            </DropdownMenuItem>

            {showDeleteOption && (
              <>
                <DropdownMenuSeparator className="border-[var(--color-border)]" />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="cursor-pointer gap-2 text-[var(--color-error)] focus:text-[var(--color-error)]"
                >
                  <Trash2 className="size-4 shrink-0" />
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
  );
}
