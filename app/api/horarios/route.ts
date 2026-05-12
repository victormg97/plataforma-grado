import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });
  }

  // Optional date filter: ?fecha=YYYY-MM-DD
  const fecha = request.nextUrl.searchParams.get('fecha');

  let query = supabase
    .from('horarios')
    .select('*, asistencia:asistencia!asistencia_horario_id_fkey(*), alumno:profiles!horarios_alumno_id_fkey(*), profesor:profiles!horarios_profesor_id_fkey(*)')
    .eq('activo', true);

  if (fecha) {
    query = query.eq('fecha', fecha);
  }

  if (profile.rol === 'profesor') {
    query = query.eq('profesor_id', user.id);
  } else if (profile.rol === 'alumno') {
    query = query.eq('alumno_id', user.id);
  }

  const { data, error } = await query.order('hora_inicio', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await request.json();

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  const profesorId = (profile?.rol === 'admin' && body.profesor_id) ? body.profesor_id : user.id;

  const { data: horario, error: horarioError } = await supabase
    .from('horarios')
    .insert({
      profesor_id: profesorId,
      alumno_id: body.alumno_id,
      titulo: body.titulo,
      descripcion: body.descripcion || null,
      fecha: body.fecha,
      hora_inicio: body.hora_inicio,
      hora_fin: body.hora_fin,
      es_recurrente: false,
      activo: true,
    })
    .select()
    .single();

  if (horarioError) {
    return NextResponse.json({ error: horarioError.message }, { status: 500 });
  }

  // Create attendance record as pending
  await supabase.from('asistencia').insert({
    horario_id: horario.id,
    alumno_id: body.alumno_id,
    estado: 'pendiente' as const,
    nuevo_horario_id: null,
    nota_alumno: null,
  });

  // If marked as exam, create a linked prueba record
  if (body.es_prueba === true) {
    await supabase.from('pruebas').insert({
      alumno_id: body.alumno_id,
      profesor_id: profesorId,
      horario_id: horario.id,
      nombre: body.titulo,
      fecha: body.fecha,
      estado: 'pendiente',
    });
  }

  return NextResponse.json(horario, { status: 201 });
}
