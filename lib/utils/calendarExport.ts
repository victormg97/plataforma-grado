/**
 * calendarExport.ts
 * Professional PDF and image export utilities for calendar/agenda views.
 * Uses jsPDF for native PDF elements and html2canvas for image capture.
 *
 * Colours are resolved at call-time from globals.css custom properties.
 * Changing a CSS var in globals.css automatically updates every export.
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { resolveCssVarToRgb, resolveCssVar, parseColorToRgb } from './cssTokens';

// ─── Brand palette (read from CSS vars at export time) ──────────────────────
type Brand = ReturnType<typeof getBrand>;

function getBrand() {
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
function hexToRgb(hex: string): [number, number, number] {
  return parseColorToRgb(hex);
}

// ─── Status colour helper ──────────────────────────────────────────────
function statusColor(status: string | undefined, brand: Brand): [number, number, number] {
  switch (status) {
    case 'confirmado': return brand.success;
    case 'cancelado':  return brand.error;
    case 'no_asistio': return brand.textMuted;
    case 'cambiado':   return brand.info;
    default:           return brand.gold;  // pendiente
  }
}

function statusLabel(status?: string, locale: 'es' | 'en' = 'es'): string {
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
function drawHeader(
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
function drawFooter(
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
function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. IMAGE EXPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Captures the FullCalendar DOM element and downloads it as a PNG.
 * @param containerEl  The `.fc` element (or parent wrapper) to capture.
 * @param filename     Base filename (without extension).
 */
export async function exportAsImage(
  containerEl: HTMLElement,
  filename: string,
): Promise<void> {
  // html2canvas v1.x has more options than the @types/html2canvas v0.5 typedefs —
  // options object is accepted at runtime; TS resolves it as compatible here.
  //
  // onclone: FullCalendar sets --fc-today-bg-color via color-mix() which html2canvas
  // cannot parse. We override it with a plain rgba() computed from the CSS var.
  const h2cOpts = {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: null,
    allowTaint: false,
    onclone: (clonedDoc: Document) => {
      const goldRaw = resolveCssVar('--color-brand-gold', '#C9993F');
      const [r, g, b] = parseColorToRgb(goldRaw);
      const s = clonedDoc.createElement('style');
      s.textContent = `.fc { --fc-today-bg-color: rgba(${r},${g},${b},0.08) !important; }`;
      clonedDoc.head.appendChild(s);
    },
  };
  const canvas = await html2canvas(
    containerEl,
    h2cOpts as unknown as Parameters<typeof html2canvas>[1],
  );

  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('html2canvas produced no blob'));
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5_000);
        resolve();
      }, 'image/png');
    } catch (err) {
      reject(err);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. MONTH PDF
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generates a professional A4-landscape monthly calendar PDF.
 */
export async function exportMonthPdf(
  events: CalendarioExportEvent[],
  year: number,
  month: number,      // 0-indexed
  locale: 'es' | 'en' = 'es',
): Promise<void> {
  const brand = getBrand();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = 297;
  const pageH = 210;
  const mX = 12; // margin x
  const mY = 12; // margin y
  const cW = pageW - mX * 2; // content width = 273

  // Month name
  const monthName = new Date(year, month, 1).toLocaleDateString(
    locale === 'es' ? 'es-CL' : 'en-US',
    { month: 'long', year: 'numeric' },
  );
  const viewLabel = locale === 'es' ? 'Vista mensual' : 'Monthly view';

  const contentStartY = drawHeader(doc, pageW, mX, mY, cW,
    monthName.replace(/^\w/, (c) => c.toUpperCase()), viewLabel, brand);

  // Day-of-week headers
  const DOW_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const DOW_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayLabels = locale === 'es' ? DOW_ES : DOW_EN;

  const colW = cW / 7;
  const dowH = 8; // day-of-week header height

  doc.setFillColor(...brand.bgSecondary);
  doc.rect(mX, contentStartY, cW, dowH, 'F');

  dayLabels.forEach((label, i) => {
    const x = mX + i * colW;
    doc.setDrawColor(...brand.border);
    doc.setLineWidth(0.25);
    doc.rect(x, contentStartY, colW, dowH, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...brand.textSecondary);
    doc.text(label, x + colW / 2, contentStartY + 5.5, { align: 'center' });
  });

  // Calendar grid
  const gridStartY = contentStartY + dowH;
  const footerH = 14;
  const gridH = pageH - gridStartY - footerH - mY;

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  // Monday-first: 0=Mon … 6=Sun
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
  const totalDays = lastDayOfMonth.getDate();
  const totalCells = Math.ceil((startOffset + totalDays) / 7) * 7;
  const rows = totalCells / 7;
  const cellH = gridH / rows;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  // Pre-index events by date string
  const byDate: Record<string, CalendarioExportEvent[]> = {};
  events.forEach((ev) => {
    const d = ev.start;
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(ev);
  });

  for (let i = 0; i < totalCells; i++) {
    const row = Math.floor(i / 7);
    const col = i % 7;
    const dayNum = i - startOffset + 1;
    const isInMonth = dayNum >= 1 && dayNum <= totalDays;
    const x = mX + col * colW;
    const y = gridStartY + row * cellH;

    const dateKey = isInMonth
      ? `${year}-${String(month+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`
      : '';
    const isToday = dateKey === todayStr;

    // Cell fill
    if (isToday) {
      // Subtle gold tint for today
      doc.setFillColor(255, 251, 235);
    } else if (!isInMonth) {
      doc.setFillColor(252, 251, 249);
    } else {
      doc.setFillColor(...brand.white);
    }
    doc.rect(x, y, colW, cellH, 'F');

    // Today border highlight
    if (isToday) {
      doc.setDrawColor(...brand.gold);
      doc.setLineWidth(0.5);
    } else {
      doc.setDrawColor(...brand.border);
      doc.setLineWidth(0.25);
    }
    doc.rect(x, y, colW, cellH, 'S');

    if (!isInMonth) continue;

    // Day number
    doc.setFont('helvetica', isToday ? 'bold' : 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(isToday ? brand.gold[0] : brand.textSecondary[0],
                     isToday ? brand.gold[1] : brand.textSecondary[1],
                     isToday ? brand.gold[2] : brand.textSecondary[2]);
    doc.text(String(dayNum), x + colW - 2.5, y + 5.5, { align: 'right' });

    // Events
    const dayEvents = (byDate[dateKey] ?? []).slice(0, 3);
    const eventH = Math.min(5.5, (cellH - 8) / 3);
    const eventSpacing = 1;

    dayEvents.forEach((ev, evIdx) => {
      const evY = y + 7.5 + evIdx * (eventH + eventSpacing);
      const [r, g, b] = hexToRgb(ev.color);
      doc.setFillColor(r, g, b);
      doc.roundedRect(x + 1.5, evY, colW - 3, eventH, 1, 1, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...brand.white);
      const label = truncate(ev.title, 16);
      doc.text(label, x + 3, evY + eventH * 0.68);
    });

    // "+N more" indicator
    const totalDayEvents = (byDate[dateKey] ?? []).length;
    if (totalDayEvents > 3) {
      const moreY = y + 7.5 + 3 * (eventH + eventSpacing);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(...brand.textMuted);
      doc.text(`+${totalDayEvents - 3}`, x + 2, moreY + 3);
    }
  }

  drawFooter(doc, pageW, pageH, mX, cW, locale, brand);

  const filename = `agenda-mensual-${year}-${String(month+1).padStart(2,'0')}.pdf`;
  doc.save(filename);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. WEEK PDF
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generates a professional A4-landscape weekly schedule PDF.
 * Layout: grouped by day with a mini event-card table per day.
 */
export async function exportWeekPdf(
  events: CalendarioExportEvent[],
  weekStart: Date,
  locale: 'es' | 'en' = 'es',
): Promise<void> {
  const brand = getBrand();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = 297;
  const pageH = 210;
  const mX = 12;
  const mY = 12;
  const cW = pageW - mX * 2;

  // Week date range label
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString(locale === 'es' ? 'es-CL' : 'en-US', {
    day: '2-digit', month: 'short',
  });
  const weekLabel = `${fmt(weekStart)} – ${fmt(weekEnd)}, ${weekEnd.getFullYear()}`;
  const viewLabel = locale === 'es' ? 'Vista semanal' : 'Weekly view';

  const contentStartY = drawHeader(doc, pageW, mX, mY, cW, weekLabel, viewLabel, brand);

  // 7 columns (one per day)
  const colW = cW / 7;

  // Day column header height
  const dayHeaderH = 10;

  const DOW_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const DOW_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayLabels = locale === 'es' ? DOW_ES : DOW_EN;

  // Group events by weekday (0=Mon..6=Sun relative to weekStart)
  const byDay: CalendarioExportEvent[][] = Array.from({ length: 7 }, () => []);
  events.forEach((ev) => {
    const evDate = new Date(ev.start);
    // diff in days from weekStart
    const diff = Math.round(
      (evDate.setHours(12,0,0,0) - new Date(weekStart).setHours(12,0,0,0)) / 86_400_000,
    );
    if (diff >= 0 && diff < 7) byDay[diff].push(ev);
  });

  // Sort each day by start time
  byDay.forEach((day) => day.sort((a, b) => a.start.getTime() - b.start.getTime()));

  const today = new Date();

  // Draw day columns
  for (let d = 0; d < 7; d++) {
    const colDate = new Date(weekStart);
    colDate.setDate(colDate.getDate() + d);
    const isToday = colDate.toDateString() === today.toDateString();
    const x = mX + d * colW;

    // Column header background
    if (isToday) {
      doc.setFillColor(...brand.gold);
    } else {
      doc.setFillColor(...brand.bgSecondary);
    }
    doc.rect(x, contentStartY, colW, dayHeaderH, 'F');

    // Day label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(isToday ? brand.black[0] : brand.textSecondary[0],
                     isToday ? brand.black[1] : brand.textSecondary[1],
                     isToday ? brand.black[2] : brand.textSecondary[2]);
    doc.text(dayLabels[d], x + colW / 2, contentStartY + 5, { align: 'center' });

    // Date number
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(String(colDate.getDate()), x + colW / 2, contentStartY + 8.5, { align: 'center' });

    // Column border
    doc.setDrawColor(...brand.border);
    doc.setLineWidth(0.25);
    doc.rect(x, contentStartY, colW, dayHeaderH, 'S');
  }

  // Event cards area
  const evAreaY = contentStartY + dayHeaderH + 2;
  const footerH = 14;
  const evAreaH = pageH - evAreaY - footerH - mY;

  // Max event cards visible per column
  const maxCards = Math.floor(evAreaH / 14); // ~14mm per card

  for (let d = 0; d < 7; d++) {
    const x = mX + d * colW;
    const dayEvents = byDay[d];

    if (dayEvents.length === 0) {
      // Empty state line
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...brand.textMuted);
      const empty = locale === 'es' ? 'Sin clases' : 'No classes';
      doc.text(empty, x + colW / 2, evAreaY + 8, { align: 'center' });
      continue;
    }

    const visibleEvents = dayEvents.slice(0, maxCards);

    visibleEvents.forEach((ev, idx) => {
      const cardY = evAreaY + idx * 14;
      const cardH = 12.5;
      const [r, g, b] = hexToRgb(ev.color);

      // Card background (light tint)
      doc.setFillColor(
        Math.round(r + (255 - r) * 0.82),
        Math.round(g + (255 - g) * 0.82),
        Math.round(b + (255 - b) * 0.82),
      );
      doc.roundedRect(x + 1.5, cardY, colW - 3, cardH, 1.5, 1.5, 'F');

      // Colour stripe on left
      doc.setFillColor(r, g, b);
      doc.roundedRect(x + 1.5, cardY, 2.5, cardH, 1, 1, 'F');
      doc.rect(x + 2.5, cardY, 1.5, cardH, 'F'); // make right side flat

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...brand.textPrimary);
      doc.text(truncate(ev.title, 18), x + 5.5, cardY + 4.5);

      // Time
      const timeStr = `${ev.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${ev.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(...brand.textMuted);
      doc.text(timeStr, x + 5.5, cardY + 8);

      // Subtitle (alumno/profesor)
      if (ev.subtitle) {
        doc.text(truncate(ev.subtitle, 20), x + 5.5, cardY + 11);
      }
    });

    // Overflow indicator
    if (dayEvents.length > maxCards) {
      const moreY = evAreaY + maxCards * 14;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(...brand.gold);
      doc.text(`+${dayEvents.length - maxCards} más`, x + 2, moreY);
    }
  }

  drawFooter(doc, pageW, pageH, mX, cW, locale, brand);

  const ws = weekStart;
  const filename = `agenda-semanal-${ws.getFullYear()}-${String(ws.getMonth()+1).padStart(2,'0')}-${String(ws.getDate()).padStart(2,'0')}.pdf`;
  doc.save(filename);
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. LIST / AGENDA PDF
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generates a professional A4-portrait agenda list PDF.
 * Layout: vertical table with status badges and alternating row colours.
 */
export async function exportListPdf(
  events: CalendarioExportEvent[],
  weekStart: Date,
  locale: 'es' | 'en' = 'es',
): Promise<void> {
  const brand = getBrand();
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const mX = 14;
  const mY = 14;
  const cW = pageW - mX * 2;

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString(locale === 'es' ? 'es-CL' : 'en-US', {
    day: '2-digit', month: 'short',
  });
  const weekLabel = `${fmt(weekStart)} – ${fmt(weekEnd)}, ${weekEnd.getFullYear()}`;
  const viewLabel = locale === 'es' ? 'Vista de agenda' : 'Agenda view';

  const contentStartY = drawHeader(doc, pageW, mX, mY, cW, weekLabel, viewLabel, brand);

  // Filter events to the visible week
  const ws = weekStart.getTime();
  const we = weekEnd.getTime() + 86_400_000; // midnight next day
  const weekEvents = events
    .filter((ev) => ev.start.getTime() >= ws && ev.start.getTime() < we)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  if (weekEvents.length === 0) {
    const noData = locale === 'es' ? 'No hay clases en este período.' : 'No classes in this period.';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...brand.textMuted);
    doc.text(noData, pageW / 2, contentStartY + 20, { align: 'center' });
    drawFooter(doc, pageW, pageH, mX, cW, locale, brand);
    doc.save(`agenda-lista-${weekStart.getFullYear()}-${String(weekStart.getMonth()+1).padStart(2,'0')}-${String(weekStart.getDate()).padStart(2,'0')}.pdf`);
    return;
  }

  // Table column definitions
  // Día | Fecha | Hora | Clase | Estado
  const cols = [
    { label: locale === 'es' ? 'Día'    : 'Day',    w: 18 },
    { label: locale === 'es' ? 'Fecha'  : 'Date',   w: 28 },
    { label: locale === 'es' ? 'Hora'   : 'Time',   w: 32 },
    { label: locale === 'es' ? 'Clase'  : 'Class',  w: 70 },
    { label: locale === 'es' ? 'Estado' : 'Status', w: 34 },
  ];
  // Total = 182 = cW ✓

  const tableHeaderH = 8;
  const rowH = 9;

  // Table header background
  doc.setFillColor(...brand.black);
  doc.rect(mX, contentStartY, cW, tableHeaderH, 'F');

  // Gold bottom stripe on header
  doc.setFillColor(...brand.gold);
  doc.rect(mX, contentStartY + tableHeaderH - 1.5, cW, 1.5, 'F');

  // Header labels
  let curX = mX;
  cols.forEach((col) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...brand.goldLight);
    doc.text(col.label.toUpperCase(), curX + 3, contentStartY + 5.2);
    curX += col.w;
  });

  // Rows
  const DOW_ES_FULL = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const DOW_EN_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dowFull = locale === 'es' ? DOW_ES_FULL : DOW_EN_FULL;

  let curY = contentStartY + tableHeaderH;

  weekEvents.forEach((ev, idx) => {
    // Multi-page support
    if (curY + rowH > pageH - 18) {
      doc.addPage();
      curY = mY;
      // Repeat table header on new page
      doc.setFillColor(...brand.black);
      doc.rect(mX, curY, cW, tableHeaderH, 'F');
      doc.setFillColor(...brand.gold);
      doc.rect(mX, curY + tableHeaderH - 1.5, cW, 1.5, 'F');
      let hX = mX;
      cols.forEach((col) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...brand.goldLight);
        doc.text(col.label.toUpperCase(), hX + 3, curY + 5.2);
        hX += col.w;
      });
      curY += tableHeaderH;
    }

    // Row fill (alternating)
    if (idx % 2 === 0) {
      doc.setFillColor(...brand.bgSecondary);
    } else {
      doc.setFillColor(...brand.white);
    }
    doc.rect(mX, curY, cW, rowH, 'F');

    // Row border (bottom only)
    doc.setDrawColor(...brand.border);
    doc.setLineWidth(0.2);
    doc.line(mX, curY + rowH, mX + cW, curY + rowH);

    const textY = curY + 5.8;

    // Day of week
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...brand.textSecondary);
    doc.text(dowFull[ev.start.getDay()], mX + 3, textY);

    // Date
    const dateStr = ev.start.toLocaleDateString(locale === 'es' ? 'es-CL' : 'en-US', {
      day: '2-digit', month: 'short',
    });
    doc.text(dateStr, mX + cols[0].w + 3, textY);

    // Time range
    const startT = ev.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endT   = ev.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    doc.text(`${startT} – ${endT}`, mX + cols[0].w + cols[1].w + 3, textY);

    // Class title + subtitle
    const titleX = mX + cols[0].w + cols[1].w + cols[2].w + 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...brand.textPrimary);
    doc.text(truncate(ev.title, 28), titleX, textY - (ev.subtitle ? 1.5 : 0));
    if (ev.subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...brand.textMuted);
      doc.text(truncate(ev.subtitle, 32), titleX, textY + 2.5);
    }

    // Status badge
    const statusX = mX + cols[0].w + cols[1].w + cols[2].w + cols[3].w;
    const [sr, sg, sb] = statusColor(ev.status, brand);
    doc.setFillColor(sr, sg, sb);
    const badgeW = 28;
    const badgeH = 5;
    const badgeY = curY + (rowH - badgeH) / 2;
    doc.roundedRect(statusX + 3, badgeY, badgeW, badgeH, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(...brand.white);
    doc.text(truncate(statusLabel(ev.status, locale), 14), statusX + 3 + badgeW / 2, badgeY + 3.5, { align: 'center' });

    curY += rowH;
  });

  // Summary section
  curY += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...brand.textMuted);
  const totalLabel = locale === 'es'
    ? `Total: ${weekEvents.length} clase${weekEvents.length !== 1 ? 's' : ''}`
    : `Total: ${weekEvents.length} class${weekEvents.length !== 1 ? 'es' : ''}`;
  doc.text(totalLabel, mX, curY);

  drawFooter(doc, pageW, pageH, mX, cW, locale, brand);

  const filename = `agenda-lista-${weekStart.getFullYear()}-${String(weekStart.getMonth()+1).padStart(2,'0')}-${String(weekStart.getDate()).padStart(2,'0')}.pdf`;
  doc.save(filename);
}
