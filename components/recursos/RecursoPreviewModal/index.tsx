'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, ExternalLink, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { getFileInfo, getExtension } from '@/lib/utils/fileInfo';
import type { RecursoItem } from '@/components/recursos/RecursoCard';

// Cache signed URLs for 50 min — they expire after 1 h from the API
const SIGNED_URL_STALE_MS = 50 * 60 * 1000;
const SIGNED_URL_GC_MS    = 55 * 60 * 1000;

interface RecursoPreviewModalProps {
  recurso: RecursoItem;
  onClose: () => void;
}

export function RecursoPreviewModal({ recurso, onClose }: RecursoPreviewModalProps) {
  const t = useTranslations('recursos');
  const overlayRef = useRef<HTMLDivElement>(null);

  const fileName = recurso.storage_path ?? recurso.titulo;
  const fileInfo  = recurso.tipo === 'archivo' ? getFileInfo(fileName) : null;
  const ext       = recurso.storage_path ? getExtension(recurso.storage_path) : '';

  // ── Cached signed URL ─────────────────────────────────────────────────────
  // queryKey is stable per recurso — React Query deduplicates concurrent fetches
  // and re-uses cached results across modal opens (up to 50 min)
  const {
    data: signedUrl,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['signed-url', recurso.id],
    queryFn: async () => {
      const res = await fetch(`/api/recursos/${recurso.id}/download`);
      if (!res.ok) throw new Error('Failed to get signed URL');
      const { url } = await res.json();
      return url as string;
    },
    enabled: recurso.tipo === 'archivo',
    staleTime: SIGNED_URL_STALE_MS,
    gcTime:    SIGNED_URL_GC_MS,
    retry: 1,
  });

  // For external links/videos use the URL directly — no fetch needed
  const url = recurso.tipo !== 'archivo' ? (recurso.url ?? null) : (signedUrl ?? null);

  // ── Keyboard / overlay close ──────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  // ── Download with forced filename ─────────────────────────────────────────
  const handleDownload = async () => {
    try {
      const res = await fetch(`/api/recursos/${recurso.id}/download?action=download`);
      const { url: dlUrl } = await res.json();
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = recurso.titulo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch { /* silent */ }
  };

  // ── Preview content ────────────────────────────────────────────────────────
  const getPreviewContent = () => {
    if (recurso.tipo === 'archivo') {
      if (isError)   return <ErrorState t={t} />;
      if (isLoading) return <LoadingState />;
    }
    if (!url)        return <LoadingState />;

    if (recurso.tipo === 'enlace' || (recurso.tipo === 'video' && !recurso.storage_path)) {
      return <ExternalLinkPreview url={url} titulo={recurso.titulo} t={t} />;
    }

    if (!fileInfo) return <DownloadPrompt titulo={recurso.titulo} onDownload={handleDownload} t={t} />;

    switch (fileInfo.previewType) {
      case 'pdf':
        return (
          <iframe
            src={url}
            className="h-full w-full rounded-[var(--radius-md)] border-0"
            title={recurso.titulo}
          />
        );
      case 'image':
        return (
          <div className="flex h-full items-center justify-center overflow-auto p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={recurso.titulo}
              className="max-h-full max-w-full rounded-[var(--radius-md)] object-contain shadow-[var(--shadow-lg)]"
            />
          </div>
        );
      case 'video':
        return (
          <div className="flex h-full items-center justify-center p-4">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={url}
              controls
              className="max-h-full max-w-full rounded-[var(--radius-md)] shadow-[var(--shadow-lg)]"
            />
          </div>
        );
      case 'audio':
        return (
          <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
            <div className={cn('flex size-20 items-center justify-center rounded-[var(--radius-xl)]', fileInfo.iconBg)}>
              <fileInfo.Icon className={cn('size-10', fileInfo.iconColor)} />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">{recurso.titulo}</p>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio src={url} controls className="w-full max-w-md" />
          </div>
        );
      default:
        return <DownloadPrompt titulo={recurso.titulo} onDownload={handleDownload} t={t} />;
    }
  };

  if (typeof window === 'undefined') return null;

  return createPortal(
    <div
      ref={overlayRef}
      role="presentation"
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      style={{ animation: 'fadeInOverlay 0.15s ease' }}
    >
      <style>{`
        @keyframes fadeInOverlay { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideInModal  { from { opacity: 0; transform: scale(0.96) translateY(8px) } to { opacity: 1; transform: scale(1) translateY(0) } }
      `}</style>

      <div
        className="relative flex h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-lg)]"
        style={{ animation: 'slideInModal 0.18s ease' }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3">
          {fileInfo && (
            <div className={cn('flex size-7 flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)]', fileInfo.iconBg)}>
              <fileInfo.Icon className={cn('size-4', fileInfo.iconColor)} />
            </div>
          )}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
              {recurso.titulo}
            </p>
            {fileInfo && ext && (
              <span className={cn(
                'flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                fileInfo.badgeColor,
              )}>
                {ext}
              </span>
            )}
          </div>

          <div className="ml-auto flex items-center gap-1">
            {/* Download trigger */}
            {recurso.tipo === 'archivo' && (
              <button
                type="button"
                title={t('descargar')}
                onClick={handleDownload}
                className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
              >
                <Download className="size-4" />
              </button>
            )}
            {url && (recurso.tipo === 'enlace' || recurso.tipo === 'video') && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                title={t('abrir')}
                className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
              >
                <ExternalLink className="size-4" />
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              title={t('cerrar')}
              className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          {getPreviewContent()}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="size-8 animate-spin text-[var(--color-brand-gold)]" />
    </div>
  );
}

function ErrorState({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-sm text-[var(--color-error)]">{t('error_subir')}</p>
    </div>
  );
}

function DownloadPrompt({
  titulo,
  onDownload,
  t,
}: {
  titulo: string;
  onDownload: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-sm text-[var(--color-text-muted)]">{t('sin_preview')}</p>
      <button
        type="button"
        onClick={onDownload}
        className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <Download className="size-4" />
        {t('descargar')}
      </button>
    </div>
  );
}

function ExternalLinkPreview({
  url,
  titulo,
  t,
}: {
  url: string;
  titulo: string;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <ExternalLink className="size-10 text-[var(--color-text-muted)]" />
      <p className="max-w-sm text-sm text-[var(--color-text-secondary)]">{titulo}</p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <ExternalLink className="size-4" />
        {t('abrir_enlace')}
      </a>
    </div>
  );
}
