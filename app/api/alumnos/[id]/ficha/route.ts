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

  // Single RPC call — includes notas del profesor actual, todos los horarios, pruebas
  const { data, error } = await supabase.rpc('get_alumno_ficha', {
    p_alumno_id: id,
    p_limit: 50, // traer todo el historial
    p_autor_id: user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ficha = data as any;
  if (!ficha?.profile) {
    return NextResponse.json({ error: 'Alumno no encontrado' }, { status: 404 });
  }

  return NextResponse.json({
    ...ficha.profile,
    alumnos_extra: ficha.extra,
    notas_alumno: ficha.notas_alumno || [],
    historial_clases: ficha.horarios || [],
    pruebas: ficha.pruebas || [],
    ficha_stats: ficha.stats,
  });
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

  const body = await request.json();

  // Check if alumnos_extra row exists
  const { data: existing } = await supabase
    .from('alumnos_extra')
    .select('id')
    .eq('alumno_id', id)
    .single();

  // Only patch columns that are in the body (partial updates)
  const updatePayload: Record<string, unknown> = {};
  if ('universidad' in body) updatePayload.universidad = body.universidad;
  if ('año_ingreso' in body) updatePayload.año_ingreso = body.año_ingreso;
  if ('notas' in body) updatePayload.notas = body.notas;
  if ('paso_prueba' in body) updatePayload.paso_prueba = body.paso_prueba;
  if ('fecha_prueba' in body) updatePayload.fecha_prueba = body.fecha_prueba;
  if ('intentos_prueba' in body) updatePayload.intentos_prueba = body.intentos_prueba;

  // Also allow blocking via activo on profiles
  if ('activo' in body) {
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ activo: body.activo })
      .eq('id', id);
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ success: true });
    }
  }

  if (Object.keys(updatePayload).length > 0) {
    if (existing) {
      const { error } = await supabase
        .from('alumnos_extra')
        .update(updatePayload)
        .eq('alumno_id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await supabase
        .from('alumnos_extra')
        .insert({ alumno_id: id, profesor_id: user.id, ...updatePayload });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
