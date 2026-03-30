import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const scope = request.nextUrl.searchParams.get('scope') || 'mis';

  // Get all alumnos with their extra info (explicit FK hint: alumnos_extra has 2 FKs to profiles)
  let query = supabase
    .from('profiles')
    .select('*, alumnos_extra!alumnos_extra_alumno_id_fkey(*)')
    .eq('rol', 'alumno')
    .eq('activo', true);

  if (scope === 'mis') {
    // Only alumnos assigned to this profesor
    const { data: extras } = await supabase
      .from('alumnos_extra')
      .select('alumno_id')
      .eq('profesor_id', user.id);

    const alumnoIds = extras?.map(e => e.alumno_id) || [];
    if (alumnoIds.length === 0) {
      return NextResponse.json([]);
    }
    query = query.in('id', alumnoIds);
  }

  const { data, error } = await query.order('nombre', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
