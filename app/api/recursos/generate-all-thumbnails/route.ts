import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/recursos/generate-all-thumbnails
 *
 * Admin-only batch endpoint that generates thumbnails for PDFs
 * that don't have one yet. Processes a batch of `limit` PDFs per call
 * to stay within Vercel's timeout limits.
 *
 * Query params:
 *   - limit: number of PDFs to process per call (default 5)
 *
 * Call repeatedly until `remaining` is 0.
 */
export const maxDuration = 60; // Vercel Pro allows up to 60s

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Auth + admin check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await adminClient
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '5', 10);

  // Get PDFs without thumbnails (limited batch)
  const { data: recursos, error } = await adminClient
    .from('recursos_compartidos')
    .select('id, storage_path, titulo')
    .eq('tipo', 'archivo')
    .ilike('storage_path', '%.pdf')
    .is('thumbnail_path', null)
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!recursos || recursos.length === 0) {
    return NextResponse.json({ message: 'All done', remaining: 0, success: 0, failed: 0 });
  }

  // Count total remaining
  const { count } = await adminClient
    .from('recursos_compartidos')
    .select('id', { count: 'exact', head: true })
    .eq('tipo', 'archivo')
    .ilike('storage_path', '%.pdf')
    .is('thumbnail_path', null);

  let success = 0;
  let failed = 0;
  const processed: string[] = [];

  for (const recurso of recursos) {
    try {
      // Download PDF
      const { data: fileData, error: dlError } = await adminClient.storage
        .from('recursos')
        .download(recurso.storage_path!);

      if (dlError || !fileData) {
        failed++;
        continue;
      }

      const arrayBuffer = await fileData.arrayBuffer();

      // Render first page
      const pdfjsLib = await import('pdfjs-dist');
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);

      const targetWidth = 400;
      const viewport = page.getViewport({ scale: 1 });
      const scale = targetWidth / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      const canvas = new OffscreenCanvas(
        Math.round(scaledViewport.width),
        Math.round(scaledViewport.height)
      );
      const ctx = canvas.getContext('2d');
      if (!ctx) { failed++; continue; }

      await page.render({
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        canvas: canvas as unknown as HTMLCanvasElement,
        viewport: scaledViewport,
      }).promise;

      // Convert to WebP
      const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.8 });

      // Upload
      const thumbnailPath = `${recurso.id}.webp`;
      const { error: uploadErr } = await adminClient.storage
        .from('recursos-thumbnails')
        .upload(thumbnailPath, blob, {
          contentType: 'image/webp',
          upsert: true,
        });

      if (uploadErr) { failed++; continue; }

      // Update DB
      await adminClient
        .from('recursos_compartidos')
        .update({ thumbnail_path: thumbnailPath })
        .eq('id', recurso.id);

      success++;
      processed.push(recurso.titulo);
    } catch {
      failed++;
    }
  }

  return NextResponse.json({
    remaining: (count ?? 0) - success,
    success,
    failed,
    processed,
  });
}
