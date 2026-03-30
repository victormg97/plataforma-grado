import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo admin' }, { status: 403 });
  }

  const body = await request.json();

  // Update profile fields
  const profileUpdates: Record<string, unknown> = {};
  if (typeof body.activo === 'boolean') profileUpdates.activo = body.activo;
  if (body.nombre !== undefined) profileUpdates.nombre = body.nombre;
  if (body.apellido !== undefined) profileUpdates.apellido = body.apellido;
  if (body.telefono !== undefined) profileUpdates.telefono = body.telefono;

  if (Object.keys(profileUpdates).length > 0) {
    const { error } = await supabase
      .from('profiles')
      .update(profileUpdates)
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Update alumnos_extra fields
  const extraUpdates: Record<string, unknown> = {};
  if (body.profesor_id !== undefined) extraUpdates.profesor_id = body.profesor_id;
  if (body.universidad !== undefined) extraUpdates.universidad = body.universidad;
  if (body.año_ingreso !== undefined) extraUpdates.año_ingreso = body.año_ingreso;
  if (body.notas !== undefined) extraUpdates.notas = body.notas;
  if (typeof body.paso_prueba === 'boolean') {
    extraUpdates.paso_prueba = body.paso_prueba;
    if (body.paso_prueba && body.fecha_prueba) {
      extraUpdates.fecha_prueba = body.fecha_prueba;
    }
  }

  if (Object.keys(extraUpdates).length > 0) {
    const { error } = await supabase
      .from('alumnos_extra')
      .update(extraUpdates)
      .eq('alumno_id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
