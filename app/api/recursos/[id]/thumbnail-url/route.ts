import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

/**
 * GET /api/recursos/[id]/thumbnail-url
 *
 * Returns a short-lived signed URL for the pre-generated thumbnail image.
 * Auth check only (no role-based access control needed since thumbnails
 * are just preview images, actual PDF access is still controlled).
 */
export async function GET(
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

  // Fetch resource thumbnail_path
  const { data: recurso } = await adminClient
    .from('recursos_compartidos')
    .select('thumbnail_path')
    .eq('id', id)
    .single();

  if (!recurso?.thumbnail_path) {
    return NextResponse.json({ error: 'No thumbnail' }, { status: 404 });
  }

  // Generate signed URL for the thumbnail
  const { data: signedData, error: signedError } = await adminClient.storage
    .from('recursos-thumbnails')
    .createSignedUrl(recurso.thumbnail_path, SIGNED_URL_EXPIRY_SECONDS);

  if (signedError || !signedData?.signedUrl) {
    return NextResponse.json({ error: 'Could not generate URL' }, { status: 500 });
  }

  return NextResponse.json({ url: signedData.signedUrl });
}
