import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// PATCH /api/notas-clase/[id]
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

  // Verify ownership
  const { data: nota } = await supabase
    .from('notas_clase')
    .select('id, autor_id')
    .eq('id', id)
    .single();

  if (!nota) {
    return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 });
  }

  if (nota.autor_id !== user.id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (profile?.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo puedes editar tus propias notas' }, { status: 403 });
    }
  }

  const body = await request.json();
  const { contenido } = body;

  if (!contenido?.trim()) {
    return NextResponse.json({ error: 'Contenido requerido' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('notas_clase')
    .update({ contenido: contenido.trim() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE /api/notas-clase/[id]
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

  // Verify ownership
  const { data: nota } = await supabase
    .from('notas_clase')
    .select('id, autor_id')
    .eq('id', id)
    .single();

  if (!nota) {
    return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 });
  }

  if (nota.autor_id !== user.id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (profile?.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo puedes eliminar tus propias notas' }, { status: 403 });
    }
  }

  const { error } = await supabase
    .from('notas_clase')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
