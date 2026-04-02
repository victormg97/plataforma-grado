import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calificarPruebaSchema } from '@/lib/validations/prueba.schema';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: prueba, error } = await supabase
    .from('pruebas')
    .select(`
      *,
      alumno:profiles!pruebas_alumno_id_fkey(id, nombre, apellido, apellido_materno, avatar_url),
      profesor:profiles!pruebas_profesor_id_fkey(id, nombre, apellido),
      horario:horarios(id, titulo, fecha, hora_inicio, hora_fin),
      clase:clases_programa(id, nombre, tipo, orden, programa_id)
    `)
    .eq('id', id)
    .single();

  if (error || !prueba) return NextResponse.json({ error: 'Prueba no encontrada' }, { status: 404 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  // Access control
  if (profile?.rol === 'alumno' && prueba.alumno_id !== user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  if (profile?.rol === 'profesor' && prueba.profesor_id !== user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  return NextResponse.json(prueba);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();
  if (!profile || profile.rol === 'alumno') {
    return NextResponse.json({ error: 'Solo profesores y admins pueden calificar pruebas' }, { status: 403 });
  }

  // Verify ownership (profesor can only grade their own students')
  const { data: prueba } = await supabase
    .from('pruebas')
    .select('id, profesor_id, alumno_id, estado')
    .eq('id', id)
    .single();

  if (!prueba) return NextResponse.json({ error: 'Prueba no encontrada' }, { status: 404 });
  if (profile.rol === 'profesor' && prueba.profesor_id !== user.id) {
    return NextResponse.json({ error: 'No autorizado para calificar esta prueba' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = calificarPruebaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { nota, observaciones } = parsed.data;
  const newEstado = nota !== undefined ? 'calificada' : 'realizada';

  const { data: updated, error } = await supabase
    .from('pruebas')
    .update({
      nota: nota ?? null,
      observaciones: observaciones ?? null,
      estado: newEstado,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(updated);
}
