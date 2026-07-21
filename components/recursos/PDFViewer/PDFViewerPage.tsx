'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { usePDFSlick } from '@pdfslick/react';
import '@pdfslick/react/dist/pdf_viewer.css';
import { cn } from '@/lib/utils';
import type { UserRol } from '@/lib/supabase/types';
import { downloadRecurso } from '@/lib/utils/downloadRecurso';
import { toast } from 'sonner';

// Cache signed URLs for 50 min — they expire after 1 h from the API
const SIGNED_URL_STALE_MS = 50 * 60 * 1000;
const SIGNED_URL_GC_MS = 55 * 60 * 1000;

interface PDFViewerPageProps {
  recursoId: string;
  rol: UserRol;
}

interface RecursoMeta {
  titulo: string;
  bloquear_descarga: boolean;
}

export function PDFViewerPage({ recursoId, rol }: PDFViewerPageProps) {
  const t = useTranslations('recursos');
  const router = useRouter();
  const [recursoMeta, setRecursoMeta] = useState<RecursoMeta | null>(null);

  // Fetch the signed URL for the PDF
  const { data: signedUrl, isLoading: urlLoading, isError } = useQuery({
    queryKey: ['signed-url', recursoId],
    queryFn: async () => {
      const res = await fetch(`/api/recursos/${recursoId}/download`);
      if (!res.ok) throw new Error('Failed to get signed URL');
      const { url } = await res.json();
      return url as string;
    },
    staleTime: SIGNED_URL_STALE_MS,
    gcTime: SIGNED_URL_GC_MS,
    retry: 1,
  });

  // Fetch resource metadata (title, download blocked flag)
  useEffect(() => {
    async function fetchMeta() {
      try {
        const res = await fetch(`/api/recursos/${recursoId}/meta`);
        if (res.ok) {
          const data = await res.json();
          setRecursoMeta(data);
        }
      } catch {
        // Non-critical, we still show the viewer
      }
    }
    fetchMeta();
  }, [recursoId]);

  const canDownload = rol === 'admin' || rol === 'profesor' || !recursoMeta?.bloquear_descarga;

  const handleDownload = async () => {
    try {
      await downloadRecurso(recursoId);
    } catch {
      toast.error(t('error_subir'));
    }
  };

  const handleBack = () => {
    // Use browser history to go back dynamically
    if (window.history.length > 1) {
      router.back();
    } else {
      // Fallback: go to recursos root based on role
      const base = rol === 'admin' ? '/admin/recursos' : rol === 'alumno' ? '/alumno/recursos' : rol === 'lector' ? '/lector/recursos' : '/admin/recursos';
      router.push(base);
    }
  };

  if (urlLoading) {
    return (
      <div className="flex h-[calc(100dvh-8rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-8 animate-spin text-[var(--color-brand-gold)]" />
          <p className="text-sm text-[var(--color-text-muted)]">{t('pdf_cargando')}</p>
        </div>
      </div>
    );
  }

  if (isError || !signedUrl) {
    return (
      <div className="flex h-[calc(100dvh-8rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-[var(--color-error)]">{t('pdf_error')}</p>
          <button
            onClick={handleBack}
            className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
          >
            <ArrowLeft className="size-4" />
            {t('pdf_volver')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <PDFViewerContent
      url={signedUrl}
      titulo={recursoMeta?.titulo ?? t('pdf_documento')}
      canDownload={canDownload}
      onDownload={handleDownload}
      onBack={handleBack}
      t={t}
    />
  );
}

// ── Inner viewer component (only mounts when URL is ready) ──────────────────

interface PDFViewerContentProps {
  url: string;
  titulo: string;
  canDownload: boolean;
  onDownload: () => void;
  onBack: () => void;
  t: ReturnType<typeof useTranslations>;
}

function PDFViewerContent({ url, titulo, canDownload, onDownload, onBack, t }: PDFViewerContentProps) {
  const {
    viewerRef,
    usePDFSlickStore,
    PDFSlickViewer,
  } = usePDFSlick(url, {
    scaleValue: 'page-width',
  });

  const pageNumber = usePDFSlickStore((s) => s.pageNumber);
  const numPages = usePDFSlickStore((s) => s.numPages);
  const scale = usePDFSlickStore((s) => s.scale);
  const pdfSlick = usePDFSlickStore((s) => s.pdfSlick);
  const isDocumentLoaded = usePDFSlickStore((s) => s.isDocumentLoaded);

  const goToPrevPage = useCallback(() => {
    if (pdfSlick && pageNumber > 1) {
      pdfSlick.gotoPage(pageNumber - 1);
    }
  }, [pdfSlick, pageNumber]);

  const goToNextPage = useCallback(() => {
    if (pdfSlick && pageNumber < numPages) {
      pdfSlick.gotoPage(pageNumber + 1);
    }
  }, [pdfSlick, pageNumber, numPages]);

  const zoomIn = useCallback(() => {
    if (pdfSlick) {
      pdfSlick.increaseScale();
    }
  }, [pdfSlick]);

  const zoomOut = useCallback(() => {
    if (pdfSlick) {
      pdfSlick.decreaseScale();
    }
  }, [pdfSlick]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goToPrevPage();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goToNextPage();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        zoomOut();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [goToPrevPage, goToNextPage, zoomIn, zoomOut]);

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-[var(--shadow-md)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 sm:px-4">
        {/* Left: back + title */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={onBack}
            className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
            title={t('pdf_volver')}
          >
            <ArrowLeft className="size-4" />
          </button>
          <span className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
            {titulo}
          </span>
        </div>

        {/* Center: page navigation */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            className="flex size-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-30"
            title={t('pdf_pagina_anterior')}
          >
            <ChevronLeft className="size-4" />
          </button>
          {isDocumentLoaded && (
            <span className="text-xs text-[var(--color-text-muted)] tabular-nums whitespace-nowrap px-1">
              {pageNumber} / {numPages}
            </span>
          )}
          <button
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            className="flex size-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-30"
            title={t('pdf_pagina_siguiente')}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* Right: zoom + download */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={zoomOut}
            className="flex size-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
            title={t('pdf_zoom_menos')}
          >
            <ZoomOut className="size-4" />
          </button>
          <span className="text-xs text-[var(--color-text-muted)] tabular-nums w-10 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            className="flex size-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)]"
            title={t('pdf_zoom_mas')}
          >
            <ZoomIn className="size-4" />
          </button>

          {canDownload && (
            <button
              onClick={onDownload}
              className="ml-2 flex size-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
              title={t('descargar')}
            >
              <Download className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* PDF viewer body */}
      <div className="relative flex-1 overflow-hidden pdfSlick">
        {!isDocumentLoaded && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--color-bg-secondary)]">
            <Loader2 className="size-8 animate-spin text-[var(--color-brand-gold)]" />
          </div>
        )}
        <PDFSlickViewer {...{ viewerRef, usePDFSlickStore }} className={cn('h-full')} />
      </div>
    </div>
  );
}
