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

  // Get user profile and role
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.rol !== 'profesor' && profile.rol !== 'admin')) {
    return NextResponse.json(
      { error: 'Solo profesores o administradores pueden gestionar solicitudes' },
      { status: 403 }
    );
  }

  // Parse request body
  const body = await request.json();
  const { estado, motivo_rechazo } = body;

  // Validate estado
  if (!estado || (estado !== 'aceptada' && estado !== 'rechazada')) {
    return NextResponse.json(
      { error: 'Estado debe ser "aceptada" o "rechazada"' },
      { status: 400 }
    );
  }

  // Fetch the solicitud
  const { data: solicitud, error: solicitudError } = await supabase
    .from('solicitudes_cambio_horario')
    .select(`
      *,
      horario_original:horarios!solicitudes_cambio_horario_horario_original_id_fkey(id, titulo, fecha, hora_inicio, hora_fin, alumno_id, profesor_id)
    `)
    .eq('id', id)
    .single();

  if (solicitudError || !solicitud) {
    return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
  }

  // Verify ownership: profesor must own the solicitud, or user is admin
  if (profile.rol === 'profesor' && solicitud.profesor_id !== user.id) {
    return NextResponse.json(
      { error: 'No autorizado para gestionar esta solicitud' },
      { status: 403 }
    );
  }

  // Validate the solicitud is still pending
  if (solicitud.estado !== 'pendiente') {
    return NextResponse.json(
      { error: 'La solicitud ya fue procesada' },
      { status: 409 }
    );
  }

  const horarioOriginal = solicitud.horario_original as {
    id: string;
    titulo: string;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    alumno_id: string;
    profesor_id: string;
  };

  if (estado === 'aceptada') {
    // Create a new horario with the proposed date/time
    const { data: nuevoHorario, error: horarioError } = await supabase
      .from('horarios')
      .insert({
        titulo: horarioOriginal.titulo,
        fecha: solicitud.fecha_propuesta,
        hora_inicio: solicitud.hora_inicio_propuesta,
        hora_fin: solicitud.hora_fin_propuesta,
        profesor_id: solicitud.profesor_id,
        alumno_id: solicitud.alumno_id,
        activo: true,
        es_recurrente: false,
      })
      .select()
      .single();

    if (horarioError || !nuevoHorario) {
      return NextResponse.json(
        { error: 'Error al crear el nuevo horario' },
        { status: 500 }
      );
    }

    // Create asistencia record for the new horario
    await supabase.from('asistencia').insert({
      horario_id: nuevoHorario.id,
      alumno_id: solicitud.alumno_id,
      estado: 'pendiente',
    });

    // Update the solicitud with estado='aceptada' and nuevo_horario_id
    const { error: updateError } = await supabase
      .from('solicitudes_cambio_horario')
      .update({
        estado: 'aceptada',
        nuevo_horario_id: nuevoHorario.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Error al actualizar la solicitud' },
        { status: 500 }
      );
    }

    // Create notification for the alumno
    await supabase.from('notificaciones').insert({
      destinatario_id: solicitud.alumno_id,
      tipo: 'cambio_horario_aceptado',
      mensaje: `Tu solicitud de cambio de horario para "${horarioOriginal.titulo}" ha sido aceptada. Nueva clase: ${solicitud.fecha_propuesta} ${solicitud.hora_inicio_propuesta}-${solicitud.hora_fin_propuesta}`,
      alumno_id: solicitud.alumno_id,
      horario_id: nuevoHorario.id,
      solicitud_id: solicitud.id,
    });

    return NextResponse.json({
      ...solicitud,
      estado: 'aceptada',
      nuevo_horario_id: nuevoHorario.id,
      nuevo_horario: nuevoHorario,
    });
  } else {
    // Rejecting the solicitud
    const { error: updateError } = await supabase
      .from('solicitudes_cambio_horario')
      .update({
        estado: 'rechazada',
        motivo_rechazo: motivo_rechazo || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Error al actualizar la solicitud' },
        { status: 500 }
      );
    }

    // Create notification for the alumno
    const mensajeRechazo = motivo_rechazo
      ? `Tu solicitud de cambio de horario para "${horarioOriginal.titulo}" ha sido rechazada. Motivo: ${motivo_rechazo}`
      : `Tu solicitud de cambio de horario para "${horarioOriginal.titulo}" ha sido rechazada.`;

    await supabase.from('notificaciones').insert({
      destinatario_id: solicitud.alumno_id,
      tipo: 'cambio_horario_rechazado',
      mensaje: mensajeRechazo,
      alumno_id: solicitud.alumno_id,
      horario_id: solicitud.horario_original_id,
      solicitud_id: solicitud.id,
    });

    return NextResponse.json({
      ...solicitud,
      estado: 'rechazada',
      motivo_rechazo: motivo_rechazo || null,
    });
  }
}
