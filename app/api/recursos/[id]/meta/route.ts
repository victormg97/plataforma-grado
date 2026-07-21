import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/recursos/[id]/meta
 *
 * Returns metadata for a resource (title, bloquear_descarga).
 * Used by the PDF viewer to know whether to show the download button.
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

  // Fetch resource metadata via admin client (no RLS)
  const { data: recurso, error } = await adminClient
    .from('recursos_compartidos')
    .select('titulo, bloquear_descarga')
    .eq('id', id)
    .single();

  if (error || !recurso) {
    return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
  }

  return NextResponse.json({
    titulo: recurso.titulo,
    bloquear_descarga: recurso.bloquear_descarga,
  });
}
