'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Clock, GraduationCap, Lock, User, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn, stripHtml } from '@/lib/utils';
import { StatusBadge } from '@/components/common/StatusBadge';
import { usePruebaTerm } from '@/lib/hooks/usePruebaTerm';
import type { EstadoAsistencia } from '@/lib/supabase/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PopoverEventData {
  titulo: string;
  hora_inicio: string;
  hora_fin: string;
  estado: EstadoAsistencia;
  alumno?: { nombre: string; apellido: string } | null;
  profesor?: { nombre: string; apellido: string } | null;
  esPrueba?: boolean;
  /** Numeric nota for prueba (null = not graded yet) */
  notaPrueba?: number | null;
  descripcion?: string | null;
  /** True when this event is a bloqueo de horario (not a class) */
  esBloqueo?: boolean;
}

interface CalendarEventPopoverProps {
  /** The event data to display */
  data: PopoverEventData | null;
  /** The DOM element to anchor the popover to */
  anchorEl: HTMLElement | null;
  /** User role determines what info is shown */
  rol: 'admin' | 'profesor' | 'alumno';
  /** Called when the popover should close */
  onClose: () => void;
}

// ─── Positioning logic ────────────────────────────────────────────────────────

function computePosition(anchor: HTMLElement): { top: number; left: number; arrowLeft: number; placement: 'top' | 'bottom' } {
  const rect = anchor.getBoundingClientRect();
  const popoverWidth = 272;
  const margin = 6;

  // Prefer showing below the event (closer to the element, more natural)
  let placement: 'top' | 'bottom' = 'bottom';
  let top = rect.bottom + margin;

  // If not enough space below, show above
  if (top + 140 > window.innerHeight) {
    placement = 'top';
    top = rect.top - margin;
  }

  // Horizontal: center on the event, but clamp to viewport
  const anchorCenter = rect.left + rect.width / 2;
  let left = anchorCenter - popoverWidth / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - popoverWidth - margin));

  // Arrow position relative to popover left edge
  const arrowLeft = Math.max(16, Math.min(anchorCenter - left, popoverWidth - 16));

  return { top, left, arrowLeft, placement };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CalendarEventPopover({ data, anchorEl, rol, onClose }: CalendarEventPopoverProps) {
  const t = useTranslations('horarios.popover');
  const pruebaTerm = usePruebaTerm();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; arrowLeft: number; placement: 'top' | 'bottom' } | null>(null);

  // Compute position when anchor changes
  useEffect(() => {
    if (!anchorEl || !data) {
      setPos(null); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    setPos(computePosition(anchorEl));
  }, [anchorEl, data]);

  // Close on scroll (calendar might scroll)
  useEffect(() => {
    if (!data) return;
    const handleScroll = () => onClose();
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', handleScroll, { capture: true });
  }, [data, onClose]);

  if (!data || !pos) return null;

  // For alumno: show nota logic (< 4.0 = reprobado, >= 4.0 = show nota)
  const renderNotaPrueba = () => {
    if (data.notaPrueba == null) {
      return (
        <span className="ml-auto text-xs text-[var(--color-text-muted)] italic">
          {t('sin_graduar')}
        </span>
      );
    }
    if (data.notaPrueba < 4.0) {
      return (
        <span className="ml-auto text-xs font-semibold text-[var(--color-error)]">
          {rol === 'alumno' ? t('reprobado') : data.notaPrueba.toFixed(1)}
        </span>
      );
    }
    return (
      <span className="ml-auto text-xs font-semibold text-[var(--color-success)]">
        {data.notaPrueba.toFixed(1)}
      </span>
    );
  };

  return createPortal(
    <div
      ref={popoverRef}
      role="tooltip"
      style={{
        position: 'fixed',
        top: pos.placement === 'bottom' ? pos.top : undefined,
        bottom: pos.placement === 'top' ? `${window.innerHeight - pos.top}px` : undefined,
        left: pos.left,
        zIndex: 9999,
        width: 272,
      }}
      className={cn(
        'pointer-events-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3 shadow-[var(--shadow-lg)]',
        'animate-in fade-in duration-150',
        pos.placement === 'top' ? 'slide-in-from-bottom-1' : 'slide-in-from-top-1',
      )}
    >
      {/* Arrow indicator */}
      <div
        className="absolute"
        style={{
          left: pos.arrowLeft,
          ...(pos.placement === 'bottom'
            ? { top: -5, transform: 'translateX(-50%)' }
            : { bottom: -5, transform: 'translateX(-50%)' }),
        }}
      >
        <div
          className={cn(
            'size-2.5 rotate-45 border bg-[var(--color-bg)]',
            pos.placement === 'bottom'
              ? 'border-l border-t border-[var(--color-border)]'
              : 'border-r border-b border-[var(--color-border)]',
          )}
        />
      </div>

      {/* Title + status */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-[var(--color-text-primary)] leading-tight line-clamp-2">
          {data.titulo}
        </p>
        {data.esBloqueo ? (
          <span className="inline-flex items-center gap-1 shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]">
            <Lock className="size-2.5" />
            {t('bloqueo_badge')}
          </span>
        ) : (
          <StatusBadge status={data.estado} />
        )}
      </div>

      {/* Time badges */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[10px] text-[var(--color-text-muted)]">
          <Clock className="size-2.5" />
          {data.hora_inicio.slice(0, 5)}
        </span>
        <span className="text-[10px] text-[var(--color-text-muted)]">–</span>
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[10px] text-[var(--color-text-muted)]">
          <Clock className="size-2.5" />
          {data.hora_fin.slice(0, 5)}
        </span>
      </div>

      {/* Bloqueo: show motivo if present, otherwise a note */}
      {data.esBloqueo ? (
        data.descripcion ? (
          <div className="flex items-start gap-1.5 text-xs text-[var(--color-text-muted)]">
            <FileText className="size-3 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{stripHtml(data.descripcion)}</span>
          </div>
        ) : (
          <p className="text-xs text-[var(--color-text-muted)] italic">{t('bloqueo_sin_motivo')}</p>
        )
      ) : (
        <>
          {/* Alumno (visible to admin and profesor) */}
          {(rol === 'admin' || rol === 'profesor') && data.alumno && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] mb-1.5">
              <User className="size-3 shrink-0" />
              <span>{data.alumno.nombre} {data.alumno.apellido}</span>
            </div>
          )}

          {/* Profesor (visible to admin and alumno) */}
          {(rol === 'admin' || rol === 'alumno') && data.profesor && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] mb-1.5">
              <User className="size-3 shrink-0 text-[var(--color-brand-gold)]" />
              <span>Prof. {data.profesor.nombre} {data.profesor.apellido}</span>
            </div>
          )}

          {/* Descripcion (truncated) */}
          {data.descripcion && (
            <div className="flex items-start gap-1.5 text-xs text-[var(--color-text-muted)] mb-1.5">
              <FileText className="size-3 shrink-0 mt-0.5" />
              <span className="line-clamp-1">{stripHtml(data.descripcion)}</span>
            </div>
          )}

          {/* Prueba badge + nota */}
          {data.esPrueba && (
            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-[var(--color-border)]">
              <GraduationCap className="size-3.5 text-[var(--color-brand-gold)]" />
              <span className="text-xs font-medium text-[var(--color-brand-gold)]">
                {t('prueba', { term: pruebaTerm.singular })}
              </span>
              {renderNotaPrueba()}
            </div>
          )}
        </>
      )}
    </div>,
    document.body,
  );
}

// ─── Hook for managing popover state ──────────────────────────────────────────

export function useCalendarPopover() {
  const [popoverData, setPopoverData] = useState<PopoverEventData | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  // Only enable on devices with hover capability
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    setIsDesktop(mq.matches); // eslint-disable-line react-hooks/set-state-in-effect
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleMouseEnter = useCallback((data: PopoverEventData, el: HTMLElement) => {
    if (!isDesktop) return;
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setPopoverData(data);
    setPopoverAnchor(el);
  }, [isDesktop]);

  const handleMouseLeave = useCallback(() => {
    if (!isDesktop) return;
    closeTimerRef.current = setTimeout(() => {
      setPopoverData(null);
      setPopoverAnchor(null);
    }, 150);
  }, [isDesktop]);

  const closePopover = useCallback(() => {
    setPopoverData(null);
    setPopoverAnchor(null);
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  return {
    popoverData,
    popoverAnchor,
    handleMouseEnter,
    handleMouseLeave,
    closePopover,
    isDesktop,
  };
}
