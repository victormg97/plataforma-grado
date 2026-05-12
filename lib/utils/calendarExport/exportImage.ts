/**
 * calendarExport/exportImage.ts
 * Captures the FullCalendar DOM element and downloads it as a PNG.
 */

import html2canvas from 'html2canvas';
import { resolveCssVar, parseColorToRgb } from '../cssTokens';

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
