import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data, error } = await supabase
    .from('notas_alumno')
    .select('id, contenido, created_at, updated_at, autor:autor_id(id, nombre, apellido)')
    .eq('alumno_id', id)
    .eq('autor_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await request.json();
  if (!body.contenido?.trim()) {
    return NextResponse.json({ error: 'Contenido requerido' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('notas_alumno')
    .insert({ alumno_id: id, autor_id: user.id, contenido: body.contenido })
    .select('id, contenido, created_at, updated_at, autor:autor_id(id, nombre, apellido)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
