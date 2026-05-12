'use client';

/**
 * CalendarioDownloadButton
 *
 * Desktop:  A subtle "Descargar" button rendered above the calendar (right-aligned).
 *           On click → dropdown with "Imagen PNG" and "PDF" options.
 *
 * Mobile:   Invisible — injects click listeners onto FullCalendar's own view-selector
 *           buttons (Mes / Semana / Agenda). When one is tapped, a floating tooltip
 *           appears ABOVE the tapped button with Imagen/PDF options. The tooltip is
 *           superimposed (position:fixed, high z-index) and never shifts page content.
 *           It auto-dismisses after 5 s or on outside click.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Download, ImageIcon, FileText, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/common/Tooltip';
import { useDownloadRateLimit } from '@/lib/hooks/useDownloadRateLimit';
import {
  exportAsImage,
  exportMonthPdf,
  exportWeekPdf,
  exportListPdf,
  type CalendarioExportEvent,
} from '@/lib/utils/calendarExport';
import { toast } from 'sonner';
import type FullCalendar from '@fullcalendar/react';
import { useLocale } from 'next-intl';

export type { CalendarioExportEvent };

interface CalendarioDownloadButtonProps {
  /** Ref to the FullCalendar instance (for reading view date range). */
  calendarRef: React.RefObject<FullCalendar | null>;
  /** Current FullCalendar view key, e.g. 'dayGridMonth'. */
  currentView: string;
  /** Whether the layout is in mobile mode. */
  isMobile: boolean;
  /**
   * CSS class selector for the calendar wrapper,
   * e.g. '.calendario-admin' — used to scope DOM queries on mobile.
   */
  containerClass: string;
  /** Normalised events array for PDF generation. */
  exportEvents: CalendarioExportEvent[];
  /** Extra className applied to the desktop button's outer wrapper. */
  className?: string;
}

type DownloadFormat = 'image' | 'pdf';

// Mobile popup anchor
interface MobilePopup {
  x: number; // fixed pixel position (center of button)
  y: number; // fixed pixel position (top of button)
}

export function CalendarioDownloadButton({
  calendarRef,
  currentView,
  isMobile,
  containerClass,
  exportEvents,
  className,
}: CalendarioDownloadButtonProps) {
  const locale = useLocale() as 'es' | 'en';

  // Desktop: the FC toolbar button element (found via DOM after FC renders)
  const [desktopBtnEl, setDesktopBtnEl] = useState<Element | null>(null);
  // Desktop: fixed-position anchor for the dropdown (null = closed)
  const [desktopDropdownPos, setDesktopDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const desktopDropdownRef = useRef<HTMLDivElement>(null);

  // Mobile tooltip state
  const [mobilePopup, setMobilePopup] = useState<MobilePopup | null>(null);
  const mobilePopupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobilePopupRef = useRef<HTMLDivElement>(null);

  // Download progress
  const [downloading, setDownloading] = useState<DownloadFormat | null>(null);

  const { isLocked, remainingSeconds, attemptDownload } = useDownloadRateLimit();

  // ── Desktop: find FC toolbar button after mount ─────────────────────────
  useEffect(() => {
    if (isMobile) return;
    const timer = setTimeout(() => {
      const btn = document.querySelector(`${containerClass} .fc-descargar-button`);
      if (btn) setDesktopBtnEl(btn);
    }, 100);
    return () => {
      clearTimeout(timer);
      setDesktopBtnEl(null);
      setDesktopDropdownPos(null);
    };
  }, [isMobile, containerClass]);

  // ── Desktop: close dropdown on outside click ─────────────────────────────
  useEffect(() => {
    if (!desktopDropdownPos) return;
    const handler = (e: MouseEvent) => {
      if (desktopDropdownRef.current && !desktopDropdownRef.current.contains(e.target as Node)) {
        setDesktopDropdownPos(null);
      }
    };
    // Add on next tick so the click that opened it doesn't immediately close it
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handler);
    };
  }, [desktopDropdownPos]);

  // ── Mobile: close popup on outside click ─────────────────────────────────
  useEffect(() => {
    if (!mobilePopup) return;
    const handler = (e: MouseEvent) => {
      if (mobilePopupRef.current && !mobilePopupRef.current.contains(e.target as Node)) {
        setMobilePopup(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobilePopup]);

  // ── Mobile: auto-dismiss popup after 5 s ──────────────────────────────────
  useEffect(() => {
    if (!mobilePopup) return;
    if (mobilePopupTimerRef.current) clearTimeout(mobilePopupTimerRef.current);
    mobilePopupTimerRef.current = setTimeout(() => setMobilePopup(null), 5_000);
    return () => {
      if (mobilePopupTimerRef.current) clearTimeout(mobilePopupTimerRef.current);
    };
  }, [mobilePopup]);

  // ── Mobile: attach click listeners to FC view buttons ─────────────────────
  // mobileCleanupRef stores the teardown function so we can call it on cleanup
  // (setTimeout returns a plain number — we cannot attach properties to it).
  const mobileCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!isMobile) return;

    // FC renders its buttons shortly after mount — allow a short delay.
    const attachTimer = setTimeout(() => {
      const selectors = [
        `${containerClass} .fc-dayGridMonth-button`,
        `${containerClass} .fc-timeGridWeek-button`,
        `${containerClass} .fc-listWeek-button`,
      ].join(', ');

      const buttons = document.querySelectorAll<HTMLButtonElement>(selectors);
      if (buttons.length === 0) return;

      const cleanups: Array<() => void> = [];

      buttons.forEach((btn) => {
        const handler = (e: Event) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setMobilePopup({
            x: rect.left + rect.width / 2,
            y: rect.top,
          });
        };
        btn.addEventListener('click', handler);
        cleanups.push(() => btn.removeEventListener('click', handler));
      });

      mobileCleanupRef.current = () => cleanups.forEach((fn) => fn());
    }, 250);

    return () => {
      clearTimeout(attachTimer);
      mobileCleanupRef.current?.();
      mobileCleanupRef.current = null;
    };
  }, [isMobile, containerClass]);

  // ── Core download handler ─────────────────────────────────────────────────
  const handleDownload = useCallback(
    async (format: DownloadFormat) => {
      if (!attemptDownload()) {
        const msg =
          locale === 'es'
            ? `Demasiadas descargas. Espera ${remainingSeconds}s.`
            : `Too many downloads. Wait ${remainingSeconds}s.`;
        toast.error(msg);
        return;
      }

      setDesktopDropdownPos(null);
      setMobilePopup(null);
      setDownloading(format);

      try {
        if (format === 'image') {
          // Target the .fc element inside the container for a clean capture
          const el = document.querySelector<HTMLElement>(`${containerClass} .fc`);
          if (!el) throw new Error('Calendar element not found');
          const ts = new Date().toISOString().slice(0, 10);
          await exportAsImage(el, `agenda-${currentView}-${ts}`);
        } else {
          const api = calendarRef.current?.getApi();
          if (!api) throw new Error('FullCalendar API not available');
          const viewStart = new Date(api.view.currentStart);

          if (currentView === 'dayGridMonth') {
            await exportMonthPdf(exportEvents, viewStart.getFullYear(), viewStart.getMonth(), locale);
          } else if (currentView === 'timeGridWeek') {
            await exportWeekPdf(exportEvents, viewStart, locale);
          } else {
            // listWeek or any other view → agenda list
            await exportListPdf(exportEvents, viewStart, locale);
          }
        }

        const ok = locale === 'es' ? 'Descarga lista ✓' : 'Download ready ✓';
        toast.success(ok);
      } catch (err) {
        console.error('[CalendarioDownloadButton] export error:', err);
        const errMsg =
          locale === 'es'
            ? 'Error al generar la descarga. Inténtalo de nuevo.'
            : 'Export failed. Please try again.';
        toast.error(errMsg);
      } finally {
        setDownloading(null);
      }
    },
    [
      attemptDownload,
      calendarRef,
      containerClass,
      currentView,
      exportEvents,
      locale,
      remainingSeconds,
    ],
  );

  // ─ View label for current view (used in buttons tooltip text) ──────────────
  const viewLabelMap: Record<string, Record<string, string>> = {
    dayGridMonth:  { es: 'Mes',    en: 'Month' },
    timeGridWeek:  { es: 'Semana', en: 'Week' },
    listWeek:      { es: 'Agenda', en: 'Agenda' },
  };
  const viewLabel = viewLabelMap[currentView]?.[locale] ?? currentView;

  // ─────────────────────────────────────────────────────────────────────────
  // MOBILE: render only the floating popup portal
  // ─────────────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        {mobilePopup && (
          <div
            ref={mobilePopupRef}
            role="dialog"
            aria-label={locale === 'es' ? 'Opciones de descarga' : 'Download options'}
            style={{
              position: 'fixed',
              left: mobilePopup.x,
              top: mobilePopup.y - 8,
              transform: 'translateX(-50%) translateY(-100%)',
              zIndex: 50,
            }}
            className="animate-in fade-in slide-in-from-bottom-2 duration-200"
          >
            {/* Main pill */}
            <div
              className={cn(
                'flex items-center gap-0.5 rounded-full',
                'bg-[var(--color-bg)] shadow-[var(--shadow-lg)]',
                'border border-[var(--color-border)]',
                'p-1',
              )}
            >
              {/* View label */}
              <span className="px-2 text-[10px] font-semibold text-[var(--color-brand-gold)] font-[var(--font-display)]">
                {viewLabel}
              </span>

              <div className="mx-0.5 h-4 w-px bg-[var(--color-border)]" />

              {/* Image button */}
              <button
                onClick={() => handleDownload('image')}
                disabled={isLocked || !!downloading}
                title={locale === 'es' ? 'Descargar imagen PNG' : 'Download PNG image'}
                className={cn(
                  'flex size-7 items-center justify-center rounded-full',
                  'text-[var(--color-text-secondary)] hover:bg-[var(--color-brand-gold-muted)] hover:text-[var(--color-brand-gold)]',
                  'transition-colors disabled:pointer-events-none disabled:opacity-40',
                )}
              >
                {downloading === 'image'
                  ? <Loader2 className="size-3.5 animate-spin" />
                  : <ImageIcon className="size-3.5" />
                }
              </button>

              {/* PDF button */}
              <button
                onClick={() => handleDownload('pdf')}
                disabled={isLocked || !!downloading}
                title={locale === 'es' ? 'Descargar PDF' : 'Download PDF'}
                className={cn(
                  'flex size-7 items-center justify-center rounded-full',
                  'text-[var(--color-text-secondary)] hover:bg-[var(--color-brand-gold-muted)] hover:text-[var(--color-brand-gold)]',
                  'transition-colors disabled:pointer-events-none disabled:opacity-40',
                )}
              >
                {downloading === 'pdf'
                  ? <Loader2 className="size-3.5 animate-spin" />
                  : <FileText className="size-3.5" />
                }
              </button>

              {/* Close */}
              <button
                onClick={() => setMobilePopup(null)}
                className="flex size-7 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                aria-label="Cerrar"
              >
                <X className="size-3" />
              </button>
            </div>

            {/* Rate-limit warning */}
            {isLocked && (
              <div className="mt-1 rounded-[var(--radius-md)] bg-[var(--color-bg)] border border-[var(--color-error)] px-2.5 py-1 text-center">
                <span className="text-[9px] font-medium text-[var(--color-error)]">
                  {locale === 'es' ? `Espera ${remainingSeconds}s` : `Wait ${remainingSeconds}s`}
                </span>
              </div>
            )}

            {/* Arrow pointing down */}
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[calc(100%-1px)]"
              aria-hidden
            >
              <div
                className="size-2.5 rotate-45 bg-[var(--color-bg)] border-r border-b border-[var(--color-border)]"
              />
            </div>
          </div>
        )}
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DESKTOP: portal into FC toolbar button + fixed dropdown portal
  // ─────────────────────────────────────────────────────────────────────────

  function handleDesktopClick() {
    if (desktopDropdownPos) {
      setDesktopDropdownPos(null);
      return;
    }
    const btn = desktopBtnEl;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setDesktopDropdownPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  }

  // Dropdown JSX (reused in both mobile and desktop portals)
  const dropdownContent = (pos: { top: number; right: number }) => (
    <div
      ref={desktopDropdownRef}
      style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 50 }}
      className={cn(
        'min-w-[168px] overflow-hidden',
        'rounded-[var(--radius-md)]',
        'bg-[var(--color-bg)] shadow-[var(--shadow-lg)] border border-[var(--color-border)]',
        'animate-in fade-in slide-in-from-top-1 duration-150',
      )}
    >
      {/* Header: current view label */}
      <div className="flex items-center gap-1.5 border-b border-[var(--color-border)] px-3 py-2">
        <Download className="size-3 text-[var(--color-brand-gold)]" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {viewLabel}
        </span>
      </div>

      {/* Image option */}
      <button
        onClick={() => handleDownload('image')}
        disabled={isLocked || !!downloading}
        className={cn(
          'flex w-full items-center gap-2.5 px-3 py-2.5',
          'text-sm text-[var(--color-text-secondary)]',
          'hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]',
          'transition-colors disabled:pointer-events-none disabled:opacity-40',
        )}
      >
        <ImageIcon className="size-3.5 shrink-0 text-[var(--color-brand-gold)]" />
        <div className="text-left">
          <p className="text-xs font-medium">
            {locale === 'es' ? 'Imagen PNG' : 'PNG Image'}
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)]">
            {locale === 'es' ? 'Captura visual' : 'Visual snapshot'}
          </p>
        </div>
      </button>

      <div className="mx-3 border-t border-[var(--color-border)]" />

      {/* PDF option */}
      <button
        onClick={() => handleDownload('pdf')}
        disabled={isLocked || !!downloading}
        className={cn(
          'flex w-full items-center gap-2.5 px-3 py-2.5',
          'text-sm text-[var(--color-text-secondary)]',
          'hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]',
          'transition-colors disabled:pointer-events-none disabled:opacity-40',
        )}
      >
        <FileText className="size-3.5 shrink-0 text-[var(--color-brand-gold)]" />
        <div className="text-left">
          <p className="text-xs font-medium">
            {locale === 'es' ? 'Documento PDF' : 'PDF Document'}
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)]">
            {locale === 'es' ? 'Diseño profesional' : 'Professional layout'}
          </p>
        </div>
      </button>

      {/* Rate-limit notice */}
      {isLocked && (
        <div className="border-t border-[var(--color-error)]/30 bg-[var(--color-error)]/5 px-3 py-2">
          <p className="text-[10px] font-medium text-[var(--color-error)]">
            {locale === 'es'
              ? `Espera ${remainingSeconds}s para volver a descargar`
              : `Wait ${remainingSeconds}s to download again`}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop: inject icon + Tooltip into the FC toolbar .fc-descargar-button via portal */}
      {!isMobile && desktopBtnEl && createPortal(
        <Tooltip content={locale === 'es' ? 'Descargar' : 'Download'}>
          <span
            role="button"
            tabIndex={0}
            aria-label={locale === 'es' ? 'Descargar agenda' : 'Download agenda'}
            onClick={handleDesktopClick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleDesktopClick(); }}
            className="inline-flex items-center justify-center"
          >
            {downloading
              ? <Loader2 className="size-3.5 animate-spin" />
              : <Download className="size-3.5" />
            }
          </span>
        </Tooltip>,
        desktopBtnEl,
      )}

      {/* Desktop: dropdown portal anchored via fixed position */}
      {!isMobile && desktopDropdownPos && typeof document !== 'undefined' &&
        createPortal(dropdownContent(desktopDropdownPos), document.body)
      }
    </>
  );
}
