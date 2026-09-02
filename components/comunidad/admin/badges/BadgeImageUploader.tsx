'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Upload, Award } from 'lucide-react';
import { useUploadBadgeImage } from '@/lib/hooks/useComunidadAdmin';
import { badgeImageUrl } from '@/components/comunidad/badges/badgeImageUrl';

/**
 * Badge image uploader (Req. 2). Validates + uploads via the API and returns
 * the stored path. Shows the recommended-dimension warning without blocking.
 */
export function BadgeImageUploader({
  imagePath,
  onUploaded,
}: {
  imagePath: string | null;
  onUploaded: (path: string) => void;
}) {
  const t = useTranslations('comunidadEstrategica');
  const upload = useUploadBadgeImage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const preview = badgeImageUrl(imagePath);

  const onFile = async (file: File) => {
    setError(null);
    setWarning(null);
    try {
      const res = await upload.mutateAsync(file);
      onUploaded(res.image_path);
      if (res.warning === 'DIMENSION_NOT_RECOMMENDED') {
        setWarning(t('badge_image_warning_dimension'));
      }
    } catch (e) {
      const code = (e as { message?: string })?.message;
      const map: Record<string, string> = {
        INVALID_FORMAT: t('badge_image_error_format'),
        TOO_LARGE: t('badge_image_error_size'),
        NOT_SQUARE: t('badge_image_error_square'),
      };
      setError(map[code ?? ''] ?? t('admin_error'));
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="flex size-16 items-center justify-center rounded-full bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]">
        {preview ? (
          <Image src={preview} alt={t('badge_image_preview_alt')} width={64} height={64} className="size-14 rounded-full object-contain" />
        ) : (
          <Award className="size-7" />
        )}
      </div>
      <div className="flex flex-col gap-1">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
          className="inline-flex w-fit items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-brand-gold)] px-3 py-2 text-sm font-medium text-[var(--color-brand-gold)] hover:bg-[var(--color-brand-gold-muted)] disabled:opacity-50"
        >
          <Upload className="size-4" />
          {upload.isPending ? t('badge_image_uploading') : t('badge_image_upload')}
        </button>
        <p className="text-xs text-[var(--color-text-muted)]">{t('badge_image_hint')}</p>
        {warning && <p className="text-xs text-[var(--color-brand-gold)]">{warning}</p>}
        {error && <p className="text-xs text-[var(--color-error)]">{error}</p>}
      </div>
    </div>
  );
}
