import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; notaId: string }> }
) {
  const { notaId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { error } = await supabase
    .from('notas_alumno')
    .delete()
    .eq('id', notaId)
    .eq('autor_id', user.id); // RLS también lo protege, pero doble check

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; notaId: string }> }
) {
  const { notaId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await request.json();
  if (!body.contenido?.trim()) {
    return NextResponse.json({ error: 'Contenido requerido' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('notas_alumno')
    .update({ contenido: body.contenido })
    .eq('id', notaId)
    .eq('autor_id', user.id)
    .select('id, contenido, created_at, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
