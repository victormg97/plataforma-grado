/**
 * Script: Generate thumbnails for all existing PDF resources.
 *
 * Since thumbnail rendering requires a browser canvas (not available
 * in Node.js serverless), this migration is done from the browser.
 *
 * ═══════════════════════════════════════════════════════════════════
 * HOW TO RUN (after deploying to Vercel):
 * ═══════════════════════════════════════════════════════════════════
 *
 * 1. Log in to the app as admin
 * 2. Open browser DevTools console (F12 → Console)
 * 3. Paste and run this script:
 *
 * ─────────────────────────────────────────────────────────────────
async function migrateThumbnails() {
  console.log('🔍 Fetching PDFs without thumbnails...');
  const listRes = await fetch('/api/recursos/generate-all-thumbnails');
  const { recursos, total } = await listRes.json();
  if (!total) { console.log('✅ All PDFs already have thumbnails!'); return; }
  console.log(`📄 Found ${total} PDFs to process.\n`);

  const pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/+esm');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  let success = 0, failed = 0;

  for (let i = 0; i < recursos.length; i++) {
    const r = recursos[i];
    try {
      // Get signed URL for the PDF
      const dlRes = await fetch(`/api/recursos/${r.id}/download`);
      if (!dlRes.ok) throw new Error('download API failed');
      const { url } = await dlRes.json();

      // Load & render first page
      const pdf = await pdfjsLib.getDocument(url).promise;
      const page = await pdf.getPage(1);
      const vp = page.getViewport({ scale: 400 / page.getViewport({ scale: 1 }).width });

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(vp.width);
      canvas.height = Math.round(vp.height);
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, canvas, viewport: vp }).promise;

      // Convert to WebP blob
      const blob = await new Promise(res => canvas.toBlob(res, 'image/webp', 0.8));

      // Upload
      const fd = new FormData();
      fd.append('file', blob);
      fd.append('recursoId', r.id);
      const upRes = await fetch('/api/recursos/generate-all-thumbnails', { method: 'POST', body: fd });
      if (!upRes.ok) throw new Error('upload failed');

      success++;
      console.log(`  [${i+1}/${total}] ✅ ${r.titulo}`);
    } catch (e) {
      failed++;
      console.log(`  [${i+1}/${total}] ❌ ${r.titulo}: ${e.message}`);
    }
    // Small delay to not overwhelm the server
    await new Promise(r => setTimeout(r, 500));
  }
  console.log(`\n🏁 Done! ${success} generated, ${failed} failed.`);
}
migrateThumbnails();
 * ─────────────────────────────────────────────────────────────────
 */

console.log(`
╔══════════════════════════════════════════════════════════════╗
║  This script runs in the BROWSER, not Node.js.              ║
║                                                             ║
║  1. Deploy to Vercel                                        ║
║  2. Log in as admin                                         ║
║  3. Open DevTools Console (F12)                             ║
║  4. Copy the script from the top of this file and paste it  ║
╚══════════════════════════════════════════════════════════════╝
`);
