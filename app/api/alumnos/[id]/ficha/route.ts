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

  // Single RPC call instead of 3 separate queries
  const { data, error } = await supabase.rpc('get_alumno_ficha', { p_alumno_id: id, p_limit: 10 });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data?.profile) {
    return NextResponse.json({ error: 'Alumno no encontrado' }, { status: 404 });
  }

  return NextResponse.json({
    ...data.profile,
    alumnos_extra: data.extra,
    historial_clases: data.horarios || [],
    ficha_stats: data.stats,
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

  // Update alumnos_extra
  const { data: existing } = await supabase
    .from('alumnos_extra')
    .select('id')
    .eq('alumno_id', id)
    .single();

  if (existing) {
    const { error } = await supabase
      .from('alumnos_extra')
      .update({
        universidad: body.universidad,
        año_ingreso: body.año_ingreso,
        notas: body.notas,
        paso_prueba: body.paso_prueba,
        fecha_prueba: body.fecha_prueba,
      })
      .eq('alumno_id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await supabase
      .from('alumnos_extra')
      .insert({
        alumno_id: id,
        profesor_id: user.id,
        universidad: body.universidad,
        año_ingreso: body.año_ingreso,
        notas: body.notas,
        paso_prueba: body.paso_prueba ?? false,
        fecha_prueba: body.fecha_prueba,
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
