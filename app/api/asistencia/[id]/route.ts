import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateEstadoChange } from '@/lib/validations/asistencia';

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

  // Fetch user profile to get rol
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  const userRol = (profile?.rol ?? 'alumno') as 'alumno' | 'profesor' | 'admin';

  // Fetch asistencia record
  const { data: existing } = await supabase
    .from('asistencia')
    .select('alumno_id, horario_id, estado')
    .eq('id', id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
  }

  // Role-aware ownership check
  if (userRol === 'admin') {
    // Admin: always allowed
  } else if (userRol === 'profesor') {
    // Profesor: allowed if they own the horario
    const { data: horario } = await supabase
      .from('horarios')
      .select('profesor_id')
      .eq('id', existing.horario_id)
      .single();

    if (!horario || horario.profesor_id !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
  } else {
    // Alumno: only their own record
    if (existing.alumno_id !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
  }

  // If estado is being changed, apply role-based validation
  if (estado) {
    let claseTerminada = false;
    let solicitudAceptada = false;

    if (userRol === 'alumno') {
      // Fetch horario fecha and hora_fin to determine if class has ended
      const { data: horario } = await supabase
        .from('horarios')
        .select('fecha, hora_fin')
        .eq('id', existing.horario_id)
        .single();

      if (horario && horario.fecha && horario.hora_fin) {
        // Get server time in Chile timezone
        const { data: serverTime } = await supabase.rpc('get_server_time');

        if (serverTime) {
          // serverTime is ISO string in Chile timezone
          const now = new Date(serverTime);
          // Combine fecha + hora_fin into a Date for comparison
          const claseFinStr = `${horario.fecha}T${horario.hora_fin}`;
          const claseFin = new Date(claseFinStr);
          claseTerminada = now >= claseFin;
        }
      }

      // Check if there's an accepted solicitud for this horario + alumno
      const { data: solicitudAceptadaData } = await supabase
        .from('solicitudes_cambio_horario')
        .select('id')
        .eq('alumno_id', user.id)
        .eq('horario_original_id', existing.horario_id)
        .eq('estado', 'aceptada')
        .limit(1)
        .maybeSingle();

      solicitudAceptada = !!solicitudAceptadaData;
    }

    // Validate the estado change
    const validation = validateEstadoChange({
      userRol,
      currentEstado: existing.estado,
      newEstado: estado,
      claseTerminada,
      solicitudAceptada,
    });

    if (!validation.allowed) {
      return NextResponse.json(
        { error: validation.errorMessage },
        { status: validation.httpStatus || 403 }
      );
    }
  }

  // Build update payload
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

  // Auto-cancel pending solicitudes when alumno confirms attendance
  if (userRol === 'alumno' && estado === 'confirmado') {
    await supabase
      .from('solicitudes_cambio_horario')
      .update({
        estado: 'rechazada',
        motivo_rechazo: 'Cancelada por el alumno al confirmar asistencia',
      })
      .eq('alumno_id', user.id)
      .eq('horario_original_id', existing.horario_id)
      .eq('estado', 'pendiente');
  }

  // Notification is created automatically by the DB trigger
  // (asistencia_on_estado_change in migration 003_notification_trigger.sql)

  return NextResponse.json(data);
}
