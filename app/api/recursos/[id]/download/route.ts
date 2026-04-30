import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

/**
 * GET /api/recursos/[id]/download
 *
 * Security flow:
 *  1. Verify the caller is authenticated.
 *  2. Fetch the resource from recursos_compartidos using the caller's session —
 *     RLS ensures they can only see records they have access to. If the record
 *     isn't returned, they don't have permission.
 *  3. Generate a short-lived signed URL for the storage object.
 *  4. Return the signed URL to the client.
 *
 * This keeps the private bucket truly private — alumnos never get direct
 * storage access, only time-limited signed URLs for files they're allowed to see.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Fetch resource — RLS will reject if user doesn't have access
  const { data: recurso, error: fetchError } = await supabase
    .from('recursos_compartidos')
    .select('id, tipo, storage_path, titulo')
    .eq('id', id)
    .single();

  if (fetchError || !recurso) {
    return NextResponse.json({ error: 'Resource not found or access denied' }, { status: 404 });
  }

  if (recurso.tipo !== 'archivo' || !recurso.storage_path) {
    return NextResponse.json({ error: 'Resource is not a file' }, { status: 400 });
  }

  // 3. Determine if inline view or force download
  const searchParams = _req.nextUrl.searchParams;
  const isDownload = searchParams.get('action') === 'download';

  // Make sure the downloaded file has the correct extension
  let filename = recurso.titulo;
  const parts = recurso.storage_path.split('.');
  const ext = parts.length > 1 ? parts[parts.length - 1] : '';
  if (ext && !filename.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
    filename = `${filename}.${ext}`;
  }

  // 4. Generate signed URL
  const { data: signedData, error: signedError } = await supabase.storage
    .from('recursos')
    .createSignedUrl(recurso.storage_path, SIGNED_URL_EXPIRY_SECONDS, {
      download: isDownload ? filename : undefined,
    });

  if (signedError || !signedData?.signedUrl) {
    return NextResponse.json({ error: 'Could not generate download URL' }, { status: 500 });
  }

  return NextResponse.json({ url: signedData.signedUrl });
}
