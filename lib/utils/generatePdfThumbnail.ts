/**
 * Generates a thumbnail image from a PDF file in the browser
 * and uploads it to the server.
 *
 * Uses pdfjs-dist to render the first page on a canvas,
 * converts to WebP blob, and POSTs to the thumbnail API.
 */
export async function generateAndUploadThumbnail(
  pdfFile: File | Blob,
  recursoId: string
): Promise<void> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

    const arrayBuffer = await pdfFile.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);

    // Render at 400px width for a good quality thumbnail
    const targetWidth = 400;
    const viewport = page.getViewport({ scale: 1 });
    const scale = targetWidth / viewport.width;
    const scaledViewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(scaledViewport.width);
    canvas.height = Math.round(scaledViewport.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    await page.render({ canvasContext: ctx, canvas, viewport: scaledViewport }).promise;

    // Convert to WebP blob
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/webp', 0.8);
    });

    if (!blob) return;

    // Upload via API
    const formData = new FormData();
    formData.append('file', blob);

    await fetch(`/api/recursos/${recursoId}/thumbnail`, {
      method: 'POST',
      body: formData,
    });
  } catch {
    // Silent fail — thumbnail is non-critical
  }
}
