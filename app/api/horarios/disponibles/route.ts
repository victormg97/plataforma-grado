import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const profesorId = request.nextUrl.searchParams.get('profesor_id');
  const alumnoId = request.nextUrl.searchParams.get('alumno_id');

  if (!profesorId || !alumnoId) {
    return NextResponse.json(
      { error: 'Se requieren profesor_id y alumno_id' },
      { status: 400 }
    );
  }

  // Get future horarios for this profesor where the alumno
  // doesn't already have an asistencia record
  const today = new Date().toISOString().split('T')[0];

  const { data: horarios, error } = await supabase
    .from('horarios')
    .select('*, asistencia:asistencia!asistencia_horario_id_fkey(alumno_id)')
    .eq('profesor_id', profesorId)
    .eq('activo', true)
    .gte('fecha', today)
    .order('fecha', { ascending: true })
    .order('hora_inicio', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter out horarios where this alumno already has attendance
  const disponibles = (horarios ?? []).filter((h) => {
    const asistencias = h.asistencia as { alumno_id: string }[] | null;
    return !asistencias?.some((a) => a.alumno_id === alumnoId);
  });

  // Remove the asistencia join data from the response
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const cleaned = disponibles.map(({ asistencia: _asistencia, ...rest }) => rest);

  return NextResponse.json(cleaned);
}
