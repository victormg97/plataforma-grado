import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('horarios')
    .select('*, asistencia:asistencia!asistencia_horario_id_fkey(*), alumno:profiles!horarios_alumno_id_fkey(*), profesor:profiles!horarios_profesor_id_fkey(*), pruebas:pruebas!pruebas_horario_id_fkey(id, nombre, estado, nota, observaciones, clase_id, alumno_id)')
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // Verify ownership (admin can edit any class)
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  const { data: existing } = await supabase
    .from('horarios')
    .select('profesor_id')
    .eq('id', id)
    .single();

  if (!existing || (existing.profesor_id !== user.id && callerProfile?.rol !== 'admin')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await request.json();

  const updateData: Record<string, unknown> = {
    alumno_id: body.alumno_id,
    titulo: body.titulo,
    descripcion: body.descripcion,
    fecha: body.fecha,
    hora_inicio: body.hora_inicio,
    hora_fin: body.hora_fin,
  };
  if (callerProfile?.rol === 'admin' && body.profesor_id) {
    updateData.profesor_id = body.profesor_id;
  }
  if ('enlace_conexion' in body) {
    updateData.enlace_conexion = body.enlace_conexion || null;
  }

  const { data, error } = await supabase
    .from('horarios')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Handle exam flag
  if (typeof body.es_prueba === 'boolean') {
    const { data: existingPrueba } = await supabase
      .from('pruebas')
      .select('id')
      .eq('horario_id', id)
      .maybeSingle();

    if (body.es_prueba && !existingPrueba) {
      // Mark as exam: create linked prueba
      await supabase.from('pruebas').insert({
        alumno_id: body.alumno_id,
        profesor_id: body.profesor_id || existing.profesor_id,
        horario_id: id,
        nombre: body.titulo,
        fecha: body.fecha,
        estado: 'pendiente',
      });
    } else if (!body.es_prueba && existingPrueba) {
      // Unmark as exam: remove linked prueba
      await supabase.from('pruebas').delete().eq('id', existingPrueba.id);
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // Verify ownership (admin can delete any class)
  const { data: callerProfileDel } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  const { data: existingDel } = await supabase
    .from('horarios')
    .select('profesor_id')
    .eq('id', id)
    .single();

  if (!existingDel || (existingDel.profesor_id !== user.id && callerProfileDel?.rol !== 'admin')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { error } = await supabase
    .from('horarios')
    .update({ activo: false })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
