import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/notas-clase?horario_id=xxx
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const horarioId = request.nextUrl.searchParams.get('horario_id');
  if (!horarioId) {
    return NextResponse.json({ error: 'horario_id requerido' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('get_notas_clase', { p_horario_id: horarioId });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/notas-clase
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await request.json();
  const { horario_id, contenido } = body;

  if (!horario_id || !contenido?.trim()) {
    return NextResponse.json({ error: 'horario_id y contenido son requeridos' }, { status: 400 });
  }

  // Verify user has access to this class
  const { data: horario } = await supabase
    .from('horarios')
    .select('id, alumno_id, profesor_id')
    .eq('id', horario_id)
    .single();

  if (!horario) {
    return NextResponse.json({ error: 'Horario no encontrado' }, { status: 404 });
  }

  // Check user is part of this class or is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (
    horario.alumno_id !== user.id &&
    horario.profesor_id !== user.id &&
    profile?.rol !== 'admin'
  ) {
    return NextResponse.json({ error: 'No autorizado para esta clase' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('notas_clase')
    .insert({
      horario_id,
      autor_id: user.id,
      contenido: contenido.trim(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
