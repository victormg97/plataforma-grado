import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { EstadoPrueba } from '@/lib/supabase/types';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const alumnoId = searchParams.get('alumno_id');
  const estado = searchParams.get('estado');

  let query = supabase
    .from('pruebas')
    .select(`
      *,
      alumno:profiles!pruebas_alumno_id_fkey(id, nombre, apellido, apellido_materno, avatar_url),
      profesor:profiles!pruebas_profesor_id_fkey(id, nombre, apellido),
      horario:horarios(id, titulo, fecha, hora_inicio, hora_fin),
      clase:clases_programa(id, nombre, tipo, orden, programa_id)
    `)
    .order('fecha', { ascending: false });

  if (profile.rol === 'alumno') {
    query = query.eq('alumno_id', user.id);
  } else if (profile.rol === 'profesor') {
    query = query.eq('profesor_id', user.id);
    if (alumnoId) query = query.eq('alumno_id', alumnoId);
  } else {
    // admin: can filter by alumno
    if (alumnoId) query = query.eq('alumno_id', alumnoId);
  }

  if (estado) query = query.eq('estado', estado as unknown as EstadoPrueba);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();
  if (!profile || profile.rol !== 'profesor' && profile.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo profesores y admins pueden crear pruebas' }, { status: 403 });
  }

  const body = await request.json();
  const { alumno_id, nombre, fecha, horario_id, clase_id, observaciones } = body;

  if (!alumno_id || !nombre || !fecha) {
    return NextResponse.json({ error: 'alumno_id, nombre y fecha son requeridos' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('pruebas')
    .insert({
      alumno_id,
      profesor_id: user.id,
      horario_id: horario_id ?? null,
      clase_id: clase_id ?? null,
      nombre: String(nombre).trim(),
      fecha,
      observaciones: observaciones ?? null,
      nota: null,
      estado: 'pendiente' as const,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
