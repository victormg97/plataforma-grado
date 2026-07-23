import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/recursos/[id]/thumbnail
 *
 * Receives a rendered thumbnail from the client (browser-generated)
 * and stores it in Supabase Storage.
 *
 * Body: FormData with 'file' (WebP/JPEG blob)
 */
export async function POST(
  req: NextRequest,
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

  // Verify the resource exists and is a PDF
  const { data: recurso } = await adminClient
    .from('recursos_compartidos')
    .select('id, storage_path, tipo, thumbnail_path')
    .eq('id', id)
    .single();

  if (!recurso) {
    return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
  }

  if (recurso.tipo !== 'archivo' || !recurso.storage_path?.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Not a PDF' }, { status: 400 });
  }

  // Skip if already has thumbnail
  if (recurso.thumbnail_path) {
    return NextResponse.json({ thumbnail_path: recurso.thumbnail_path });
  }

  // Get the file from FormData
  const formData = await req.formData();
  const file = formData.get('file') as Blob | null;

  if (!file) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  // Upload thumbnail
  const thumbnailPath = `${id}.webp`;
  const { error: uploadErr } = await adminClient.storage
    .from('recursos-thumbnails')
    .upload(thumbnailPath, file, {
      contentType: 'image/webp',
      upsert: true,
    });

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  // Update record
  await adminClient
    .from('recursos_compartidos')
    .update({ thumbnail_path: thumbnailPath })
    .eq('id', id);

  return NextResponse.json({ thumbnail_path: thumbnailPath });
}
