import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

/**
 * GET /api/recursos/[id]/download
 *
 * Security flow:
 *  1. Verify the caller is authenticated (user session via cookies).
 *  2. Fetch the caller's profile to get their role.
 *  3. Fetch the resource via admin client (bypasses RLS).
 *  4. Manually verify the caller has access based on their role:
 *     - admin: always allowed
 *     - profesor: only their own resources
 *     - alumno: para_todos from admin, para_todos from their assigned profesor,
 *               or explicitly granted via recursos_acceso
 *  5. If download is blocked (bloquear_descarga=true), reject alumno download requests.
 *  6. Generate a short-lived signed URL via admin client and return it.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const adminClient = createAdminClient();

  // 1. Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Get caller's profile
  const { data: profile } = await adminClient
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 403 });
  }

  // 3. Fetch resource via admin client (no RLS)
  const { data: recurso, error: fetchError } = await adminClient
    .from('recursos_compartidos')
    .select('id, tipo, storage_path, titulo, bloquear_descarga, para_todos, subido_por')
    .eq('id', id)
    .single();

  if (fetchError || !recurso) {
    return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
  }

  if (recurso.tipo !== 'archivo' || !recurso.storage_path) {
    return NextResponse.json({ error: 'Resource is not a file' }, { status: 400 });
  }

  // 4. Manual access check based on role
  const rol = profile.rol;

  if (rol === 'admin') {
    // Admin: always allowed
  } else if (rol === 'profesor') {
    // Profesor: only their own resources
    if (recurso.subido_por !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
  } else if (rol === 'alumno') {
    // Alumno: check access conditions
    let hasAccess = false;

    // Condition 1: explicit grant via recursos_acceso
    const { data: acceso } = await adminClient
      .from('recursos_acceso')
      .select('id')
      .eq('recurso_id', id)
      .eq('alumno_id', user.id)
      .maybeSingle();
    if (acceso) hasAccess = true;

    if (!hasAccess && recurso.para_todos) {
      // Condition 2: para_todos from admin
      const { data: uploader } = await adminClient
        .from('profiles')
        .select('rol')
        .eq('id', recurso.subido_por)
        .single();
      if (uploader?.rol === 'admin') hasAccess = true;

      // Condition 3: para_todos from assigned profesor
      if (!hasAccess) {
        const { data: asignacion } = await adminClient
          .from('alumnos_extra')
          .select('alumno_id')
          .eq('alumno_id', user.id)
          .eq('profesor_id', recurso.subido_por)
          .maybeSingle();
        if (asignacion) hasAccess = true;
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // 5. If download is blocked, reject alumno download requests
  const searchParams = _req.nextUrl.searchParams;
  const isDownload = searchParams.get('action') === 'download';

  if (isDownload && recurso.bloquear_descarga && rol === 'alumno') {
    return NextResponse.json({ error: 'Download not allowed for this resource' }, { status: 403 });
  }

  // 6. Build filename with correct extension
  let filename = recurso.titulo;
  const parts = recurso.storage_path.split('.');
  const ext = parts.length > 1 ? parts[parts.length - 1] : '';
  if (ext && !filename.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
    filename = `${filename}.${ext}`;
  }

  // 7. Generate signed URL
  const { data: signedData, error: signedError } = await adminClient.storage
    .from('recursos')
    .createSignedUrl(recurso.storage_path, SIGNED_URL_EXPIRY_SECONDS, {
      download: isDownload ? filename : undefined,
    });

  if (signedError || !signedData?.signedUrl) {
    return NextResponse.json({ error: 'Could not generate download URL' }, { status: 500 });
  }

  return NextResponse.json({ url: signedData.signedUrl });
}
