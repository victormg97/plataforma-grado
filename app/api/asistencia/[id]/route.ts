import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { estado, nuevo_horario_id, nota_alumno } = body;

  // Verify ownership — alumno can only update their own attendance
  const { data: existing } = await supabase
    .from('asistencia')
    .select('alumno_id, horario_id')
    .eq('id', id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
  }

  if (existing.alumno_id !== user.id) {
    // Allow profesor to update if they own the horario
    const { data: horario } = await supabase
      .from('horarios')
      .select('profesor_id')
      .eq('id', existing.horario_id)
      .single();

    if (!horario || horario.profesor_id !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
  }

  const updateData: Record<string, unknown> = {};
  if (estado) updateData.estado = estado;
  if (nota_alumno !== undefined) updateData.nota_alumno = nota_alumno;
  if (nuevo_horario_id !== undefined) updateData.nuevo_horario_id = nuevo_horario_id;

  const { data, error } = await supabase
    .from('asistencia')
    .update(updateData)
    .eq('id', id)
    .select('*, horario:horarios!asistencia_horario_id_fkey(titulo, profesor_id)')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notification is created automatically by the DB trigger
  // (asistencia_on_estado_change in migration 003_notification_trigger.sql)

  return NextResponse.json(data);
}
