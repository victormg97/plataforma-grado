import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/recursos/generate-all-thumbnails
 *
 * Admin-only endpoint that returns the list of PDFs that need thumbnails.
 * The actual rendering happens client-side (browser has canvas support).
 *
 * POST /api/recursos/generate-all-thumbnails
 *
 * Receives a thumbnail image blob from the client and uploads it.
 * Body: FormData with 'file' (WebP blob) and 'recursoId' (string)
 */
export const maxDuration = 60;

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Auth + admin check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await adminClient
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  // Get PDFs without thumbnails
  const { data: recursos, error } = await adminClient
    .from('recursos_compartidos')
    .select('id, storage_path, titulo')
    .eq('tipo', 'archivo')
    .ilike('storage_path', '%.pdf')
    .is('thumbnail_path', null)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ recursos: recursos ?? [], total: recursos?.length ?? 0 });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Auth + admin check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await adminClient
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  // Parse FormData
  const formData = await req.formData();
  const file = formData.get('file') as Blob | null;
  const recursoId = formData.get('recursoId') as string | null;

  if (!file || !recursoId) {
    return NextResponse.json({ error: 'Missing file or recursoId' }, { status: 400 });
  }

  // Upload to thumbnails bucket
  const thumbnailPath = `${recursoId}.webp`;
  const { error: uploadErr } = await adminClient.storage
    .from('recursos-thumbnails')
    .upload(thumbnailPath, file, {
      contentType: 'image/webp',
      upsert: true,
    });

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  // Update DB
  const { error: updateErr } = await adminClient
    .from('recursos_compartidos')
    .update({ thumbnail_path: thumbnailPath })
    .eq('id', recursoId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, thumbnail_path: thumbnailPath });
}
