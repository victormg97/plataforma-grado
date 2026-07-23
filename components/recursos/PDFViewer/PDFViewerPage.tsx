'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft,
  Download,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X,
  MoreVertical,
  Maximize,
  Printer,
  ChevronsLeft,
  ChevronsRight,
  RotateCw,
  RotateCcw,
} from 'lucide-react';
import { usePDFSlick, PDFSlickThumbnails } from '@pdfslick/react';
import '@pdfslick/react/dist/pdf_viewer.css';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/common/Tooltip';
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

  useEffect(() => {
    async function fetchMeta() {
      try {
        const res = await fetch(`/api/recursos/${recursoId}/meta`);
        if (res.ok) {
          const data = await res.json();
          setRecursoMeta(data);
        }
      } catch { /* Non-critical */ }
    }
    fetchMeta();
  }, [recursoId]);

  const canDownload = rol === 'admin' || rol === 'profesor' || !recursoMeta?.bloquear_descarga;

  const handleDownload = async () => {
    try { await downloadRecurso(recursoId); }
    catch { toast.error(t('error_subir')); }
  };

  const handleBack = () => {
    if (window.history.length > 1) { router.back(); }
    else {
      const base = rol === 'admin' ? '/admin/recursos' : rol === 'alumno' ? '/alumno/recursos' : rol === 'lector' ? '/lector/recursos' : '/admin/recursos';
      router.push(base);
    }
  };

  if (urlLoading) {
    return (
      <div className="flex h-[calc(100dvh-5.5rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-8 animate-spin text-[var(--color-brand-gold)]" />
          <p className="text-sm text-[var(--color-text-muted)]">{t('pdf_cargando')}</p>
        </div>
      </div>
    );
  }

  if (isError || !signedUrl) {
    return (
      <div className="flex h-[calc(100dvh-5.5rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-[var(--color-error)]">{t('pdf_error')}</p>
          <button onClick={handleBack} className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)]">
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

// ── Inner viewer component ──────────────────────────────────────────────────

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
    thumbsRef,
    usePDFSlickStore,
    PDFSlickViewer,
  } = usePDFSlick(url, {
    scaleValue: 'page-width',
  });

  const pageNumber = usePDFSlickStore((s) => s.pageNumber);
  const numPages = usePDFSlickStore((s) => s.numPages);
  const scale = usePDFSlickStore((s) => s.scale);
  const pdfSlick = usePDFSlickStore((s) => s.pdfSlick);
  const pagesRotation = usePDFSlickStore((s) => s.pagesRotation);
  const isDocumentLoaded = usePDFSlickStore((s) => s.isDocumentLoaded);

  // UI state
  const [showThumbnails, setShowThumbnails] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('pdf-thumbs-open') === '1';
  });
  const [showSearch, setShowSearch] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageInput, setPageInput] = useState('');
  const [zoomInput, setZoomInput] = useState('');
  const [isEditingPage, setIsEditingPage] = useState(false);
  const [isEditingZoom, setIsEditingZoom] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pageInputRef = useRef<HTMLInputElement>(null);
  const zoomInputRef = useRef<HTMLInputElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Sync page input
  useEffect(() => { if (!isEditingPage) setPageInput(String(pageNumber)); }, [pageNumber, isEditingPage]);
  // Sync zoom input
  useEffect(() => { if (!isEditingZoom) setZoomInput(String(Math.round(scale * 100))); }, [scale, isEditingZoom]);
  // Focus search input
  useEffect(() => { if (showSearch) searchInputRef.current?.focus(); }, [showSearch]);
  // Close more menu on outside click
  useEffect(() => {
    if (!showMoreMenu) return;
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) setShowMoreMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMoreMenu]);

  const goToPrevPage = useCallback(() => { if (pdfSlick && pageNumber > 1) pdfSlick.gotoPage(pageNumber - 1); }, [pdfSlick, pageNumber]);
  const goToNextPage = useCallback(() => { if (pdfSlick && pageNumber < numPages) pdfSlick.gotoPage(pageNumber + 1); }, [pdfSlick, pageNumber, numPages]);
  const zoomIn = useCallback(() => { if (pdfSlick) pdfSlick.increaseScale(); }, [pdfSlick]);
  const zoomOut = useCallback(() => { if (pdfSlick) pdfSlick.decreaseScale(); }, [pdfSlick]);

  const handlePageSubmit = () => {
    const page = parseInt(pageInput, 10);
    if (pdfSlick && !isNaN(page) && page >= 1 && page <= numPages) pdfSlick.gotoPage(page);
    else setPageInput(String(pageNumber));
    setIsEditingPage(false);
  };

  const handleZoomSubmit = () => {
    const zoom = parseInt(zoomInput, 10);
    if (pdfSlick && !isNaN(zoom) && zoom >= 10 && zoom <= 500) pdfSlick.currentScale = zoom / 100;
    else setZoomInput(String(Math.round(scale * 100)));
    setIsEditingZoom(false);
  };

  // More menu actions
  const goToFirstPage = () => { if (pdfSlick) pdfSlick.gotoPage(1); setShowMoreMenu(false); };
  const goToLastPage = () => { if (pdfSlick) pdfSlick.gotoPage(numPages); setShowMoreMenu(false); };
  const rotateClockwise = () => { if (pdfSlick) pdfSlick.setRotation((pagesRotation + 90) % 360); setShowMoreMenu(false); };
  const rotateCounterClockwise = () => { if (pdfSlick) pdfSlick.setRotation((pagesRotation + 270) % 360); setShowMoreMenu(false); };
  const enterPresentationMode = () => { if (pdfSlick) pdfSlick.requestPresentationMode(); setShowMoreMenu(false); };
  const handlePrint = () => { if (pdfSlick) pdfSlick.triggerPrinting(); setShowMoreMenu(false); };

  // Presentation mode keyboard navigation
  useEffect(() => {
    const handleFullscreenKeydown = (e: KeyboardEvent) => {
      if (!document.fullscreenElement || !pdfSlick) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        pdfSlick.gotoPage(Math.min(pdfSlick.viewer.currentPageNumber + 1, numPages));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        pdfSlick.gotoPage(Math.max(pdfSlick.viewer.currentPageNumber - 1, 1));
      } else if (e.key === 'Home') {
        e.preventDefault();
        pdfSlick.gotoPage(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        pdfSlick.gotoPage(numPages);
      } else if (e.key === 'Escape') {
        document.exitFullscreen();
      }
    };
    document.addEventListener('keydown', handleFullscreenKeydown);
    return () => document.removeEventListener('keydown', handleFullscreenKeydown);
  }, [pdfSlick, numPages]);

  // Search
  const handleSearch = useCallback(() => {
    if (!pdfSlick || !searchQuery.trim()) return;
    pdfSlick.dispatch('find', { source: pdfSlick.viewer, type: '', query: searchQuery, caseSensitive: false, highlightAll: true, findPrevious: false });
  }, [pdfSlick, searchQuery]);

  const handleSearchNext = useCallback(() => {
    if (!pdfSlick || !searchQuery.trim()) return;
    pdfSlick.dispatch('find', { source: pdfSlick.viewer, type: 'again', query: searchQuery, caseSensitive: false, highlightAll: true, findPrevious: false });
  }, [pdfSlick, searchQuery]);

  const handleSearchPrev = useCallback(() => {
    if (!pdfSlick || !searchQuery.trim()) return;
    pdfSlick.dispatch('find', { source: pdfSlick.viewer, type: 'again', query: searchQuery, caseSensitive: false, highlightAll: true, findPrevious: true });
  }, [pdfSlick, searchQuery]);

  const closeSearch = useCallback(() => {
    setShowSearch(false);
    setSearchQuery('');
    if (pdfSlick) pdfSlick.dispatch('find', { source: pdfSlick.viewer, type: '', query: '', caseSensitive: false, highlightAll: false, findPrevious: false });
  }, [pdfSlick]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); setShowSearch(true); return; }
      if (e.key === 'Escape') { if (showSearch) { closeSearch(); return; } if (showMoreMenu) { setShowMoreMenu(false); return; } }
      if (isInput) return;
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomIn(); }
      else if (e.key === '-') { e.preventDefault(); zoomOut(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut, showSearch, showMoreMenu, closeSearch]);

  // Pinch-to-zoom on touch devices — controls PDF scale, not browser zoom
  useEffect(() => {
    if (!pdfSlick) return;
    let lastDistance = 0;
    let initialScale = 1;

    const getDistance = (t1: Touch, t2: Touch) =>
      Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        lastDistance = getDistance(e.touches[0], e.touches[1]);
        initialScale = pdfSlick.viewer.currentScale;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !lastDistance) return;
      e.preventDefault();
      const distance = getDistance(e.touches[0], e.touches[1]);
      const ratio = distance / lastDistance;
      const newScale = Math.min(Math.max(initialScale * ratio, 0.25), 5);
      pdfSlick.currentScale = newScale;
    };

    const onTouchEnd = () => { lastDistance = 0; };

    const el = document.querySelector('.pdfSlick');
    if (!el) return;
    el.addEventListener('touchstart', onTouchStart as EventListener, { passive: false });
    el.addEventListener('touchmove', onTouchMove as EventListener, { passive: false });
    el.addEventListener('touchend', onTouchEnd as EventListener);
    return () => {
      el.removeEventListener('touchstart', onTouchStart as EventListener);
      el.removeEventListener('touchmove', onTouchMove as EventListener);
      el.removeEventListener('touchend', onTouchEnd as EventListener);
    };
  }, [pdfSlick]);

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-[var(--shadow-md)] touch-manipulation">
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 sm:gap-2 sm:px-3">
        {/* Left: back + thumbnails toggle + title */}
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <Tooltip content={t('pdf_volver')} position="bottom">
            <button onClick={onBack} className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]">
              <ArrowLeft className="size-4" />
            </button>
          </Tooltip>
          <Tooltip content={t('pdf_miniaturas')} position="bottom">
            <button onClick={() => setShowThumbnails((v) => { const next = !v; localStorage.setItem('pdf-thumbs-open', next ? '1' : '0'); return next; })} className={cn('hidden sm:flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] transition-colors', showThumbnails ? 'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]')}>
              {showThumbnails ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
            </button>
          </Tooltip>
          <span className="truncate text-sm font-semibold text-[var(--color-text-primary)] hidden sm:block">{titulo}</span>
        </div>

        {/* Center: page navigation */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Tooltip content={t('pdf_pagina_anterior')} position="bottom">
            <button onClick={goToPrevPage} disabled={pageNumber <= 1} className="flex size-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-30">
              <ChevronLeft className="size-4" />
            </button>
          </Tooltip>
          {isDocumentLoaded && (
            <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] tabular-nums whitespace-nowrap">
              <input ref={pageInputRef} type="text" inputMode="numeric" value={isEditingPage ? pageInput : String(pageNumber)} onChange={(e) => { setPageInput(e.target.value); setIsEditingPage(true); }} onFocus={() => { setIsEditingPage(true); setPageInput(String(pageNumber)); pageInputRef.current?.select(); }} onBlur={handlePageSubmit} onKeyDown={(e) => { if (e.key === 'Enter') { handlePageSubmit(); pageInputRef.current?.blur(); } }} className="w-8 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1 py-0.5 text-center text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold-muted)]" aria-label={t('pdf_ir_pagina')} />
              <span>{t('pdf_de')} {numPages}</span>
            </div>
          )}
          <Tooltip content={t('pdf_pagina_siguiente')} position="bottom">
            <button onClick={goToNextPage} disabled={pageNumber >= numPages} className="flex size-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-30">
              <ChevronRight className="size-4" />
            </button>
          </Tooltip>
        </div>

        {/* Right: zoom + search + more */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Tooltip content={t('pdf_zoom_menos')} position="bottom">
            <button onClick={zoomOut} className="flex size-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)]">
              <ZoomOut className="size-3.5" />
            </button>
          </Tooltip>
          <input ref={zoomInputRef} type="text" inputMode="numeric" value={isEditingZoom ? zoomInput : `${Math.round(scale * 100)}%`} onChange={(e) => { setZoomInput(e.target.value.replace('%', '')); setIsEditingZoom(true); }} onFocus={() => { setIsEditingZoom(true); setZoomInput(String(Math.round(scale * 100))); zoomInputRef.current?.select(); }} onBlur={handleZoomSubmit} onKeyDown={(e) => { if (e.key === 'Enter') { handleZoomSubmit(); zoomInputRef.current?.blur(); } }} className="w-12 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1 py-0.5 text-center text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold-muted)]" aria-label={t('pdf_zoom_valor')} />
          <Tooltip content={t('pdf_zoom_mas')} position="bottom">
            <button onClick={zoomIn} className="flex size-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)]">
              <ZoomIn className="size-3.5" />
            </button>
          </Tooltip>

          <div className="mx-0.5 h-5 w-px bg-[var(--color-border)] hidden sm:block" />

          <Tooltip content={t('pdf_buscar')} position="bottom">
            <button onClick={() => setShowSearch((v) => !v)} className={cn('hidden sm:flex size-7 items-center justify-center rounded-[var(--radius-sm)] transition-colors', showSearch ? 'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]')}>
              <Search className="size-3.5" />
            </button>
          </Tooltip>

          {canDownload && (
            <Tooltip content={t('descargar')} position="bottom">
              <button onClick={onDownload} className="hidden sm:flex size-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]">
                <Download className="size-3.5" />
              </button>
            </Tooltip>
          )}

          {/* More options menu */}
          <div className="relative" ref={moreMenuRef}>
            <Tooltip content={t('pdf_opciones')} position="bottom">
              <button onClick={() => setShowMoreMenu((v) => !v)} className={cn('flex size-7 items-center justify-center rounded-[var(--radius-sm)] transition-colors', showMoreMenu ? 'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]')}>
                <MoreVertical className="size-3.5" />
              </button>
            </Tooltip>
            {showMoreMenu && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] py-1 shadow-[var(--shadow-lg)]">
                {/* Mobile-only: search and download */}
                <button onClick={() => { setShowSearch((v) => !v); setShowMoreMenu(false); }} className="flex sm:hidden w-full items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] text-left">
                  <Search className="size-4 text-[var(--color-text-muted)]" />
                  {t('pdf_buscar')}
                </button>
                {canDownload && (
                  <button onClick={() => { onDownload(); setShowMoreMenu(false); }} className="flex sm:hidden w-full items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] text-left">
                    <Download className="size-4 text-[var(--color-text-muted)]" />
                    {t('descargar')}
                  </button>
                )}
                <div className="my-1 h-px bg-[var(--color-border)] sm:hidden" />
                <button onClick={enterPresentationMode} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] text-left">
                  <Maximize className="size-4 text-[var(--color-text-muted)]" />
                  {t('pdf_presentacion')}
                </button>
                {canDownload && (
                  <button onClick={handlePrint} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] text-left">
                    <Printer className="size-4 text-[var(--color-text-muted)]" />
                    {t('pdf_imprimir')}
                  </button>
                )}
                <div className="my-1 h-px bg-[var(--color-border)]" />
                <button onClick={goToFirstPage} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] text-left">
                  <ChevronsLeft className="size-4 text-[var(--color-text-muted)]" />
                  {t('pdf_primera_pagina')}
                </button>
                <button onClick={goToLastPage} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] text-left">
                  <ChevronsRight className="size-4 text-[var(--color-text-muted)]" />
                  {t('pdf_ultima_pagina')}
                </button>
                <div className="my-1 h-px bg-[var(--color-border)]" />
                <button onClick={rotateClockwise} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] text-left">
                  <RotateCw className="size-4 text-[var(--color-text-muted)]" />
                  {t('pdf_rotar_derecha')}
                </button>
                <button onClick={rotateCounterClockwise} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] text-left">
                  <RotateCcw className="size-4 text-[var(--color-text-muted)]" />
                  {t('pdf_rotar_izquierda')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search bar (collapsible) */}
      {showSearch && (
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5">
          <Search className="size-3.5 shrink-0 text-[var(--color-text-muted)]" />
          <input ref={searchInputRef} type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.shiftKey ? handleSearchPrev() : (searchQuery ? handleSearchNext() : handleSearch()); } }} placeholder={t('pdf_buscar_placeholder')} className="flex-1 bg-transparent text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]" />
          <div className="flex items-center gap-0.5">
            <Tooltip content={t('pdf_buscar_anterior')} position="bottom">
              <button onClick={handleSearchPrev} disabled={!searchQuery} className="flex size-6 items-center justify-center rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] disabled:opacity-30">
                <ChevronLeft className="size-3.5" />
              </button>
            </Tooltip>
            <Tooltip content={t('pdf_buscar_siguiente')} position="bottom">
              <button onClick={handleSearchNext} disabled={!searchQuery} className="flex size-6 items-center justify-center rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] disabled:opacity-30">
                <ChevronRight className="size-3.5" />
              </button>
            </Tooltip>
          </div>
          <button onClick={closeSearch} className="flex size-6 items-center justify-center rounded text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Main content: thumbnails sidebar + PDF viewer */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Thumbnails sidebar — always mounted, visually toggled */}
        <div className={cn(
          'relative z-10 shrink-0 overflow-hidden border-r border-[var(--color-border)] bg-[var(--color-bg)] transition-[width,padding] duration-200',
          showThumbnails ? 'w-44 p-2 lg:w-52 overflow-y-auto' : 'w-0 border-r-0',
        )}>
          <PDFSlickThumbnails {...{ thumbsRef, usePDFSlickStore, className: 'flex flex-col items-center gap-2' }}>
            {({ pageNumber: thumbPage, width, height, src, pageLabel, loaded }) => (
              <button
                type="button"
                onClick={() => pdfSlick?.gotoPage(thumbPage)}
                className={cn(
                  'relative mx-auto rounded-[var(--radius-sm)] p-0.5 transition-all shrink-0',
                  loaded && thumbPage === pageNumber
                    ? 'ring-2 ring-[var(--color-brand-gold)] shadow-[var(--shadow-sm)]'
                    : 'hover:ring-1 hover:ring-[var(--color-border-strong)]',
                )}
              >
                <div
                  className={cn(
                    'overflow-hidden rounded-[var(--radius-xs)] border',
                    loaded && thumbPage === pageNumber
                      ? 'border-[var(--color-brand-gold)]'
                      : 'border-[var(--color-border)]',
                    !loaded && 'bg-[var(--color-bg-secondary)] animate-pulse',
                  )}
                  style={{ width: `${width}px`, height: `${height}px` }}
                >
                  {src && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} width={width} height={height} alt={`${t('pdf_pagina')} ${thumbPage}`} className="block" />
                  )}
                </div>
                <span className={cn(
                  'mt-1 block text-center text-[10px] tabular-nums',
                  thumbPage === pageNumber ? 'font-semibold text-[var(--color-brand-gold)]' : 'text-[var(--color-text-muted)]',
                )}>
                  {pageLabel ?? thumbPage}
                </span>
              </button>
            )}
          </PDFSlickThumbnails>
        </div>

        {/* PDF viewer */}
        <div className="relative flex-1 overflow-hidden pdfSlick touch-pan-y">
          {!isDocumentLoaded && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--color-bg-secondary)]">
              <Loader2 className="size-8 animate-spin text-[var(--color-brand-gold)]" />
            </div>
          )}
          <PDFSlickViewer {...{ viewerRef, usePDFSlickStore }} className={cn('h-full')} />
        </div>
      </div>
    </div>
  );
}
