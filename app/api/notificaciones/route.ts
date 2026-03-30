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

  if (!profile) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const soloNoLeidas = searchParams.get('no_leidas') === 'true';

  let query = supabase
    .from('notificaciones')
    .select('*, alumno:alumno_id(id, nombre, apellido), horario:horario_id(id, fecha, hora_inicio, hora_fin, titulo, descripcion), destinatario:destinatario_id(id, nombre, apellido, rol)')
    .order('created_at', { ascending: false })
    .limit(limit);

  // Admin sees ALL notifications, everyone else sees only their own
  if (profile.rol !== 'admin') {
    query = query.eq('destinatario_id', user.id);
  }

  if (soloNoLeidas) {
    query = query.eq('leida', false);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await request.json();
  const { ids, marcar_todo } = body;

  if (marcar_todo) {
    const { error } = await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('destinatario_id', user.id)
      .eq('leida', false);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (Array.isArray(ids) && ids.length > 0) {
    const { error } = await supabase
      .from('notificaciones')
      .update({ leida: true })
      .in('id', ids)
      .eq('destinatario_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Se requiere id' }, { status: 400 });

  // RLS ensures destinatario_id = auth.uid(), but we double-check to be explicit
  const { error } = await supabase
    .from('notificaciones')
    .delete()
    .eq('id', id)
    .eq('destinatario_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
