/**
 * calendarExport/exportListPdf.ts
 * Generates a professional A4-portrait agenda list PDF.
 */

import jsPDF from 'jspdf';
import {
  type CalendarioExportEvent,
  getBrand,
  statusColor,
  statusLabel,
  truncate,
  drawHeader,
  drawFooter,
} from './shared';

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
