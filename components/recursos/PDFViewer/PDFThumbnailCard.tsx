'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FileText, Download, FolderInput, Pencil, Trash2, Globe, Users, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CardActions, type CardAction } from '@/components/common/CardActions';
import type { RecursoItem } from '@/components/recursos/RecursoCard';
import type { UserRol } from '@/lib/supabase/types';
import { getThumbnailFromCache, setThumbnailInCache, hasThumbnailInCache } from '@/lib/utils/pdfThumbnailCache';

// Cache signed URLs for 50 min
const SIGNED_URL_STALE_MS = 50 * 60 * 1000;
const SIGNED_URL_GC_MS = 55 * 60 * 1000;

interface PDFThumbnailCardProps {
  recurso: RecursoItem;
  rol: UserRol;
  uploaderIdMatch: boolean;
  onDelete?: (id: string) => void;
  onEdit?: (recurso: RecursoItem) => void;
  onDownload?: (recurso: RecursoItem) => Promise<void> | void;
  onMove?: (recurso: RecursoItem) => void;
}

export function PDFThumbnailCard({
  recurso,
  rol,
  uploaderIdMatch,
  onDelete,
  onEdit,
  onDownload,
  onMove,
}: PDFThumbnailCardProps) {
  const t = useTranslations('recursos');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [thumbnailReady, setThumbnailReady] = useState(() => hasThumbnailInCache(recurso.id));
  const [thumbnailError, setThumbnailError] = useState(false);
  const [cachedSrc, setCachedSrc] = useState<string | null>(() => getThumbnailFromCache(recurso.id));
  const [isVisible, setIsVisible] = useState(false);

  const canManage = rol === 'admin' || (rol === 'profesor' && uploaderIdMatch);
  const canDownload = rol !== 'alumno' || !recurso.bloquear_descarga;

  const pdfViewerHref = `/recursos/pdf/${recurso.id}`;

  // Intersection observer for lazy loading thumbnails
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Fetch signed URL for this PDF (only when visible)
  const { data: signedUrl } = useQuery({
    queryKey: ['signed-url', recurso.id],
    queryFn: async () => {
      const res = await fetch(`/api/recursos/${recurso.id}/download`);
      if (!res.ok) throw new Error('Failed to get signed URL');
      const { url } = await res.json();
      return url as string;
    },
    enabled: isVisible,
    staleTime: SIGNED_URL_STALE_MS,
    gcTime: SIGNED_URL_GC_MS,
    retry: 1,
  });

  // Render first page thumbnail on canvas using pdfjs-dist
  useEffect(() => {
    // Skip if already cached
    if (cachedSrc || !signedUrl || !canvasRef.current || !isVisible) return;

    let cancelled = false;

    async function renderThumbnail() {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        const loadingTask = pdfjsLib.getDocument({ url: signedUrl! });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const page = await pdf.getPage(1);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        // Scale to fit card width with 2x for retina
        const desiredWidth = 260;
        const viewport = page.getViewport({ scale: 1 });
        const scale = (desiredWidth * 2) / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        await page.render({ canvasContext: ctx, canvas, viewport: scaledViewport }).promise;
        if (!cancelled) {
          // Cache the rendered thumbnail as data URL
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setThumbnailInCache(recurso.id, dataUrl);
          setCachedSrc(dataUrl);
          setThumbnailReady(true);
        }
      } catch {
        if (!cancelled) {
          setThumbnailError(true);
        }
      }
    }

    renderThumbnail();
    return () => { cancelled = true; };
  }, [signedUrl, isVisible, cachedSrc, recurso.id]);

  // Build actions for the ellipsis menu
  const actions: CardAction[] = [];

  if (canDownload && onDownload) {
    actions.push({
      key: 'descargar',
      label: t('descargar'),
      icon: <Download className="size-4" />,
      onClick: () => onDownload(recurso),
    });
  }

  if (canManage && onMove) {
    actions.push({
      key: 'mover',
      label: t('mover_a_carpeta'),
      icon: <FolderInput className="size-4" />,
      onClick: () => onMove(recurso),
    });
  }

  if (canManage && onEdit) {
    actions.push({
      key: 'editar',
      label: t('editar'),
      icon: <Pencil className="size-4" />,
      onClick: () => onEdit(recurso),
    });
  }

  if (canManage && onDelete) {
    actions.push({
      key: 'eliminar',
      label: t('eliminar'),
      icon: <Trash2 className="size-4" />,
      onClick: () => onDelete(recurso.id),
      danger: true,
    });
  }

  return (
    <div
      ref={containerRef}
      role="article"
      className="group relative flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-sm)] transition-all hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-md)]"
    >
      {/* Thumbnail area — clickable Link with prefetch */}
      <Link
        href={pdfViewerHref}
        prefetch={true}
        className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-[var(--color-bg-secondary)] cursor-pointer"
      >
        {!thumbnailReady && !thumbnailError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="size-5 animate-spin text-[var(--color-text-muted)]" />
          </div>
        )}
        {thumbnailError && (
          <div className="flex flex-col items-center gap-2">
            <FileText className="size-8 text-[#E44D26]" />
            <span className="text-xs text-[var(--color-text-muted)]">PDF</span>
          </div>
        )}
        {cachedSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cachedSrc}
            alt={recurso.titulo}
            className="max-h-full max-w-full object-contain"
            style={{ width: '100%', height: 'auto' }}
          />
        ) : (
          <canvas
            ref={canvasRef}
            className={cn(
              'max-h-full max-w-full object-contain transition-opacity',
              thumbnailReady ? 'opacity-100' : 'opacity-0',
            )}
            style={{ width: '100%', height: 'auto' }}
          />
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/5" />
      </Link>

      {/* Info footer */}
      <div className="flex items-start gap-2 p-3">
        <Link
          href={pdfViewerHref}
          prefetch={true}
          className="flex-1 min-w-0"
        >
          <p className="truncate text-sm font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-brand-gold)] transition-colors">
            {recurso.titulo}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
            <span className="text-[11px] text-[var(--color-text-muted)]">
              {format(new Date(recurso.created_at), 'd MMM yyyy', { locale: es })}
            </span>
            {(rol === 'admin' || rol === 'profesor') && (
              <span className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium',
                recurso.para_todos_app
                  ? 'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]'
                  : recurso.para_todos
                  ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]',
              )}>
                {recurso.para_todos_app
                  ? <><Globe className="size-2" />{t('todos_app')}</>
                  : recurso.para_todos
                  ? <><Globe className="size-2" />{t('para_todos')}</>
                  : <><Users className="size-2" />{t('solo_asignados', { count: recurso.acceso_count ?? 0 })}</>}
              </span>
            )}
          </div>
        </Link>

        {/* Actions menu */}
        {actions.length > 0 && (
          <div onClick={(e) => e.stopPropagation()}>
            <CardActions actions={actions} mobileOnly />
          </div>
        )}
      </div>
    </div>
  );
}
