/**
 * calendarExport/shared.ts
 * Shared utilities, types, and helpers for calendar PDF/image exports.
 *
 * Colours are resolved at call-time from globals.css custom properties.
 * Changing a CSS var in globals.css automatically updates every export.
 */

import jsPDF from 'jspdf';
import { resolveCssVarToRgb, parseColorToRgb } from '../cssTokens';

// ─── Brand palette (read from CSS vars at export time) ──────────────────────
export type Brand = ReturnType<typeof getBrand>;

export function getBrand() {
  const r = resolveCssVarToRgb;
  return {
    black:        r('--color-brand-black',     '#1a1a1a'),
    gold:         r('--color-brand-gold',      '#C9993F'),
    goldLight:    r('--color-brand-gold-light','#E8C97A'),
    white:        r('--color-brand-white',     '#FFFFFF'),
    bgSecondary:  r('--color-bg-secondary',    '#F8F6F2'),
    textPrimary:  r('--color-text-primary',    '#1a1a1a'),
    textSecondary:r('--color-text-secondary',  '#4a4a4a'),
    textMuted:    r('--color-text-muted',      '#888888'),
    border:       r('--color-border',          '#E5E0D8'),
    success:      r('--color-success',         '#2D6A4F'),
    error:        r('--color-error',           '#C0392B'),
    info:         r('--color-info',            '#2C5F8A'),
  };
}

/**
 * Normalized event interface — each calendar variant provides these fields.
 */
export interface CalendarioExportEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  /** Resolved hex colour for the event (e.g. "#C9993F") */
  color: string;
  /** Optional subtitle (alumno name, profesor name, etc.) */
  subtitle?: string;
  /** Attendance / estado string */
  status?: string;
}

// ─── Colour parsing helper ───────────────────────────────────────────────
export function hexToRgb(hex: string): [number, number, number] {
  return parseColorToRgb(hex);
}

// ─── Status colour helper ──────────────────────────────────────────────
export function statusColor(status: string | undefined, brand: Brand): [number, number, number] {
  switch (status) {
    case 'confirmado': return brand.success;
    case 'cancelado':  return brand.error;
    case 'no_asistio': return brand.textMuted;
    case 'cambiado':   return brand.info;
    default:           return brand.gold;  // pendiente
  }
}

export function statusLabel(status?: string, locale: 'es' | 'en' = 'es'): string {
  const map: Record<string, Record<string, string>> = {
    pendiente:  { es: 'Pendiente',  en: 'Pending' },
    confirmado: { es: 'Confirmado', en: 'Confirmed' },
    cancelado:  { es: 'Cancelado',  en: 'Canceled' },
    no_asistio: { es: 'No asistió', en: 'No-show' },
    cambiado:   { es: 'Cambiado',   en: 'Changed' },
  };
  return map[status ?? 'pendiente']?.[locale] ?? (status ?? '');
}

// ─── Shared PDF header ───────────────────────────────────────────────────────
/**
 * Draws the CTA Graduados branded header band.
 * Returns the Y position right after the header.
 */
export function drawHeader(
  doc: jsPDF,
  pageW: number,
  marginX: number,
  marginY: number,
  contentW: number,
  title: string,
  subtitle: string,
  brand: Brand,
): number {
  const hH = 22; // header height (mm)

  // Background
  doc.setFillColor(...brand.black);
  doc.rect(marginX, marginY, contentW, hH, 'F');

  // Gold accent stripe at bottom
  doc.setFillColor(...brand.gold);
  doc.rect(marginX, marginY + hH - 2, contentW, 2, 'F');

  // Logo text — left
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...brand.gold);
  doc.text('CTA', marginX + 5, marginY + 8);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...brand.goldLight);
  doc.text('GRADUADOS', marginX + 5, marginY + 13);

  // Title — centre
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...brand.white);
  doc.text(title, pageW / 2, marginY + 10, { align: 'center' });

  // Subtitle — centre (smaller)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...brand.goldLight);
  doc.text(subtitle, pageW / 2, marginY + 16.5, { align: 'center' });

  return marginY + hH + 4; // content starts here
}

// ─── Shared PDF footer ───────────────────────────────────────────────────────
export function drawFooter(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  marginX: number,
  contentW: number,
  locale: 'es' | 'en',
  brand: Brand,
): void {
  const footerY = pageH - 10;
  doc.setDrawColor(...brand.border);
  doc.setLineWidth(0.3);
  doc.line(marginX, footerY - 2, marginX + contentW, footerY - 2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...brand.textMuted);
  doc.text('CTA Graduados', marginX, footerY + 2);

  const dateStr = new Date().toLocaleDateString(locale === 'es' ? 'es-CL' : 'en-US', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const genLabel = locale === 'es' ? `Generado el ${dateStr}` : `Generated on ${dateStr}`;
  doc.text(genLabel, marginX + contentW, footerY + 2, { align: 'right' });
}

// ─── Truncate text ───────────────────────────────────────────────────────────
export function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
}
