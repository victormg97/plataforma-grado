import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  const profesorId = request.nextUrl.searchParams.get('profesor_id');

  let query = supabase
    .from('bloqueos_horario')
    .select('*')
    .eq('activo', true)
    .order('fecha', { ascending: true })
    .order('hora_inicio', { ascending: true });

  if (profile?.rol === 'admin') {
    // Admin puede filtrar por profesor o ver todos
    if (profesorId) query = query.eq('profesor_id', profesorId);
  } else {
    // Profesor solo ve los suyos
    query = query.eq('profesor_id', user.id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await request.json();

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  // Admin puede crear bloqueos para cualquier profesor; profesor solo para sí mismo
  const profesorId =
    profile?.rol === 'admin' && body.profesor_id ? body.profesor_id : user.id;

  const { data, error } = await supabase
    .from('bloqueos_horario')
    .insert({
      profesor_id: profesorId,
      fecha: body.fecha,
      hora_inicio: body.hora_inicio,
      hora_fin: body.hora_fin,
      motivo: body.motivo || null,
      activo: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
