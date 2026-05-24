/**
 * calendarExport/exportMonthPdf.ts
 * Generates a professional A4-landscape monthly calendar PDF.
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
 * Generates a professional A4-landscape monthly calendar PDF.
 */
export async function exportMonthPdf(
  events: CalendarioExportEvent[],
  year: number,
  month: number,      // 0-indexed
  locale: 'es' | 'en' = 'es',
  appName?: string,
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
    monthName.replace(/^\w/, (c) => c.toUpperCase()), viewLabel, brand, appName);

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

  drawFooter(doc, pageW, pageH, mX, cW, locale, brand, appName);

  const filename = `agenda-mensual-${year}-${String(month+1).padStart(2,'0')}.pdf`;
  doc.save(filename);
}
