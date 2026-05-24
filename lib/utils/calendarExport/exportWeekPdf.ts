/**
 * calendarExport/exportWeekPdf.ts
 * Generates a professional A4-landscape weekly schedule PDF.
 */

import jsPDF from 'jspdf';
import {
  type CalendarioExportEvent,
  getBrand,
  hexToRgb,
  truncate,
  drawHeader,
  drawFooter,
} from './shared';

/**
 * Generates a professional A4-landscape weekly schedule PDF.
 * Layout: grouped by day with a mini event-card table per day.
 */
export async function exportWeekPdf(
  events: CalendarioExportEvent[],
  weekStart: Date,
  locale: 'es' | 'en' = 'es',
  appName?: string,
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

  const contentStartY = drawHeader(doc, pageW, mX, mY, cW, weekLabel, viewLabel, brand, appName);

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

  drawFooter(doc, pageW, pageH, mX, cW, locale, brand, appName);

  const ws = weekStart;
  const filename = `agenda-semanal-${ws.getFullYear()}-${String(ws.getMonth()+1).padStart(2,'0')}-${String(ws.getDate()).padStart(2,'0')}.pdf`;
  doc.save(filename);
}
