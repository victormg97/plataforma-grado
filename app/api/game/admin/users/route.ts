import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireGameAdmin } from '@/lib/comunidad/admin-guard';

// GET: lightweight user list for the manual badge-grant picker.
// Optional ?q= filters by name/email; optional ?rol= filters by role.
export async function GET(req: NextRequest) {
  const guard = await requireGameAdmin();
  if ('response' in guard) return guard.response;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();
  const rol = searchParams.get('rol')?.trim();

  const admin = createAdminClient();
  let query = admin
    .from('profiles')
    .select('id, nombre, apellido, email, rol')
    .eq('activo', true)
    .order('nombre')
    .limit(50);

  if (rol) query = query.eq('rol', rol);
  if (q) query = query.or(`nombre.ilike.%${q}%,apellido.ilike.%${q}%,email.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
