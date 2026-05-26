import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const scope = request.nextUrl.searchParams.get('scope') || 'mis';

  const { data, error } = await supabase.rpc('get_alumnos_profesor', {
    p_profesor_id: user.id,
    p_scope: scope,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Reshape to match AlumnoConExtra shape expected by the frontend
  const result = (data ?? []).map((r: Record<string, unknown>) => ({
    ...r,
    alumnos_extra: r.alumno_id ? [{
      alumno_id: r.alumno_id,
      profesor_id: r.profesor_id,
      universidad: r.universidad,
      año_ingreso: r.año_ingreso,
      notas: r.notas,
      paso_prueba: r.paso_prueba,
      fecha_prueba: r.fecha_prueba,
      ha_dado_examen: r.ha_dado_examen,
      intentos_prueba: r.intentos_prueba,
    }] : [],
  }));

  return NextResponse.json(result);
}
