import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('rol').eq('id', user.id).single();
  if (!profile || profile.rol !== 'alumno') {
    return NextResponse.json({ error: 'No autorizado. Solo alumnos.' }, { status: 403 });
  }

  // Verify the assignment
  const { data: asignacion } = await supabase
    .from('asignaciones_programa')
    .select('id, created_at')
    .eq('programa_id', id)
    .eq('alumno_id', user.id)
    .eq('estado', 'activo')
    .single();

  if (!asignacion) {
    return NextResponse.json({ error: 'No tienes asignado este programa.' }, { status: 403 });
  }

  // Fetch the program data — alumno can see this via RLS (has active assignment, migration 015).
  const { data, error } = await supabase
    .from('programas_clases')
    .select(`
      id,
      nombre,
      descripcion,
      created_at,
      profesor:profiles!programas_clases_profesor_id_fkey(id, nombre, apellido, avatar_url),
      clases_programa(id, nombre, tipo, orden, duracion_min)
    `)
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  // Sort clases by orden
  if (data.clases_programa) {
    data.clases_programa.sort((a: { orden: number }, b: { orden: number }) => a.orden - b.orden);
  }

  // Get the traceability records mapping class templates to actual schedules
  // `horarios_programa` links asignacion_id + clase_id to horario_id
  const { data: horariosPrograma } = await supabase
    .from('horarios_programa')
    .select('clase_id, horario_id')
    .eq('asignacion_id', asignacion.id);

  // Fetch all actual horarios for this student to know the dates and status
  const horarioIds = (horariosPrograma || []).map(hp => hp.horario_id).filter(Boolean);
  let horariosData: any[] = [];
  if (horarioIds.length > 0) {
    const { data: hData } = await supabase
      .from('horarios')
      .select('id, fecha, hora_inicio, hora_fin, activo')
      .in('id', horarioIds);
      
    // Also fetch asistencia for these horarios
    const { data: asisData } = await supabase
      .from('asistencia')
      .select('horario_id, estado, nota_alumno')
      .in('horario_id', horarioIds)
      .eq('alumno_id', user.id);

    // Merge asistencia into horarios
    horariosData = (hData || []).map(h => {
      const asis = (asisData || []).find(a => a.horario_id === h.id);
      return { ...h, asistencia_estado: asis?.estado ?? 'pendiente' };
    });
  }

  // Get the student's tests specifically in these classes
  const claseIds = (data.clases_programa || []).filter((c: any) => c.tipo === 'prueba').map((c: any) => c.id);
  let pruebasData: any[] = [];
  if (claseIds.length > 0) {
    const { data: rTests } = await supabase
      .from('pruebas')
      .select('id, clase_id, nombre, fecha, nota, observaciones, estado')
      .eq('alumno_id', user.id)
      .in('clase_id', claseIds);
    pruebasData = rTests || [];
  }

  const result = {
    ...data,
    asignado_el: asignacion.created_at,
    clases_programadas: data.clases_programa?.map((cp: any) => {
      const hp = (horariosPrograma || []).find(h => h.clase_id === cp.id);
      const horario = hp ? horariosData.find(h => h.id === hp.horario_id) : null;
      const prueba = cp.tipo === 'prueba' ? pruebasData.find(p => p.clase_id === cp.id) : null;
      
      return {
        ...cp,
        horario: horario || null,
        prueba: prueba || null
      };
    })
  };

  return NextResponse.json(result);
}
