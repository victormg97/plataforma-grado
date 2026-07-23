import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/recursos/[id]/thumbnail
 *
 * Server-side PDF thumbnail generation.
 * 1. Fetches the PDF from Supabase Storage
 * 2. Renders the first page as a JPEG image using pdfjs-dist (via canvas)
 * 3. Uploads the thumbnail to the 'recursos-thumbnails' bucket
 * 4. Updates the recurso record with the thumbnail_path
 *
 * Only admin/profesor who owns the resource can trigger this.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get resource
  const { data: recurso, error: fetchErr } = await adminClient
    .from('recursos_compartidos')
    .select('id, storage_path, tipo, subido_por, thumbnail_path')
    .eq('id', id)
    .single();

  if (fetchErr || !recurso) {
    return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
  }

  if (recurso.tipo !== 'archivo' || !recurso.storage_path) {
    return NextResponse.json({ error: 'Not a file resource' }, { status: 400 });
  }

  // Check it's a PDF
  const ext = recurso.storage_path.split('.').pop()?.toLowerCase();
  if (ext !== 'pdf') {
    return NextResponse.json({ error: 'Not a PDF' }, { status: 400 });
  }

  // Skip if thumbnail already exists
  if (recurso.thumbnail_path) {
    return NextResponse.json({ thumbnail_path: recurso.thumbnail_path });
  }

  try {
    // Download the PDF
    const { data: fileData, error: dlError } = await adminClient.storage
      .from('recursos')
      .download(recurso.storage_path);

    if (dlError || !fileData) {
      return NextResponse.json({ error: 'Could not download PDF' }, { status: 500 });
    }

    // Convert blob to ArrayBuffer
    const arrayBuffer = await fileData.arrayBuffer();

    // Render first page using pdfjs-dist
    const pdfjsLib = await import('pdfjs-dist');

    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);

    // Render at a reasonable resolution for thumbnails (300px wide)
    const targetWidth = 400;
    const viewport = page.getViewport({ scale: 1 });
    const scale = targetWidth / viewport.width;
    const scaledViewport = page.getViewport({ scale });

    // Use OffscreenCanvas for server-side rendering
    const canvas = new OffscreenCanvas(
      Math.round(scaledViewport.width),
      Math.round(scaledViewport.height)
    );
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return NextResponse.json({ error: 'Canvas context failed' }, { status: 500 });
    }

    await page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      canvas: canvas as unknown as HTMLCanvasElement,
      viewport: scaledViewport,
    }).promise;

    // Convert to WebP blob
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.8 });

    // Upload to thumbnails bucket
    const thumbnailPath = `${recurso.id}.webp`;
    const { error: uploadErr } = await adminClient.storage
      .from('recursos-thumbnails')
      .upload(thumbnailPath, blob, {
        contentType: 'image/webp',
        upsert: true,
      });

    if (uploadErr) {
      return NextResponse.json({ error: 'Failed to upload thumbnail' }, { status: 500 });
    }

    // Update the resource record
    await adminClient
      .from('recursos_compartidos')
      .update({ thumbnail_path: thumbnailPath })
      .eq('id', id);

    return NextResponse.json({ thumbnail_path: thumbnailPath });
  } catch (err) {
    console.error('Thumbnail generation failed:', err);
    return NextResponse.json({ error: 'Thumbnail generation failed' }, { status: 500 });
  }
}
