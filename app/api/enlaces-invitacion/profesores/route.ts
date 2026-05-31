import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET: lista de perfiles asignables (profesores y admins) para el selector de
// profesor asignado al crear/editar un enlace de alumno. Solo admin.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'NO_AUTORIZADO' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'PROHIBIDO' }, { status: 403 });
  }

  const { data: rows, error } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, rol')
    .in('rol', ['profesor', 'admin'])
    .eq('activo', true)
    .order('nombre', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'ERROR_DB', message: error.message }, { status: 500 });
  }

  return NextResponse.json(rows ?? []);
}
