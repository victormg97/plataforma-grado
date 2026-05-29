import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateEstadoChange } from '@/lib/validations/asistencia';
import { sendNotificationEmail } from '@/lib/email/emailService';
import type { SolicitudCorreo, TipoCorreo } from '@/lib/email/types';

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
    let plazoVencido = false;

    if (userRol === 'alumno') {
      // Fetch horario with hora_inicio, hora_fin, and professor's cancellation_deadline_hours
      const { data: horario } = await supabase
        .from('horarios')
        .select('fecha, hora_inicio, hora_fin, profesor:profiles!horarios_profesor_id_fkey(cancellation_deadline_hours)')
        .eq('id', existing.horario_id)
        .single();

      const cancellationDeadlineHours =
        (horario?.profesor as { cancellation_deadline_hours: number } | null)
          ?.cancellation_deadline_hours ?? 0;

      // Get server time once — reused for both plazoVencido and claseTerminada
      const { data: serverTime } = await supabase.rpc('get_server_time');
      if (!serverTime) {
        return NextResponse.json({ error: 'No se pudo obtener la hora del servidor' }, { status: 500 });
      }

      const now = new Date(serverTime);

      if (horario && horario.fecha && horario.hora_inicio && horario.hora_fin) {
        // Compute plazoVencido: now >= classStart - deadlineHours
        const classStart = new Date(`${horario.fecha}T${horario.hora_inicio}`);
        const deadlineMs = cancellationDeadlineHours * 3600 * 1000;
        plazoVencido = now.getTime() >= classStart.getTime() - deadlineMs;

        // Compute claseTerminada using the same server time
        const claseFin = new Date(`${horario.fecha}T${horario.hora_fin}`);
        claseTerminada = now >= claseFin;
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

      // Validate the estado change
      const validation = validateEstadoChange({
        userRol,
        currentEstado: existing.estado,
        newEstado: estado,
        claseTerminada,
        solicitudAceptada,
        plazoVencido,
        cancellationDeadlineHours,
      });

      if (!validation.allowed) {
        return NextResponse.json(
          { error: validation.errorMessage },
          { status: validation.httpStatus || 403 }
        );
      }
    }
    // Profesor and admin: validateEstadoChange always returns allowed: true — no check needed
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

  // Disparo de correo NO bloqueante (Requisito 4.1, 4.2, 4.3, 4.4, 4.7).
  // Solo cuando un Alumno lleva la asistencia a 'confirmado' o 'cancelado'
  // (los cambios de profesor/admin no disparan correo, Requisito 4.3).
  // El envío es fire-and-forget: la respuesta HTTP NO espera al correo
  // (Requisito 4.4) y un fallo nunca revierte el cambio ya persistido
  // (Requisito 4.6). La notificación realtime la mantiene el trigger DB.
  if (userRol === 'alumno' && (estado === 'confirmado' || estado === 'cancelado')) {
    const tipo: TipoCorreo = estado === 'confirmado' ? 'confirmacion' : 'cancelacion';
    const horario = data.horario as { titulo: string | null; profesor_id: string | null } | null;
    const profesorId = horario?.profesor_id ?? null;

    if (profesorId) {
      // Toda la preparación (lecturas con admin client para sortear RLS) y el
      // envío se ejecutan en una IIFE async fire-and-forget para no retrasar la
      // respuesta (Requisito 4.4). `.catch()` defensivo: nunca propaga errores.
      void (async () => {
        const admin = createAdminClient();

        // Datos del profesor (destinatario): el alumno no puede leerlos por RLS.
        const { data: profesor } = await admin
          .from('profiles')
          .select('email, idioma, nombre, apellido')
          .eq('id', profesorId)
          .single();

        if (!profesor?.email) return;

        // Datos del alumno (originador) para la variable {nombre_alumno}.
        const { data: alumno } = await admin
          .from('profiles')
          .select('nombre, apellido')
          .eq('id', user.id)
          .single();

        // Datos del horario para las variables de la clase (Requisito 9.1).
        const { data: horarioData } = await admin
          .from('horarios')
          .select('titulo, fecha, hora_inicio, hora_fin')
          .eq('id', existing.horario_id)
          .single();

        const nombreProfesor = [profesor.nombre, profesor.apellido]
          .filter(Boolean)
          .join(' ')
          .trim();
        const nombreAlumno = [alumno?.nombre, alumno?.apellido]
          .filter(Boolean)
          .join(' ')
          .trim();

        const solicitud: SolicitudCorreo = {
          tipo,
          originadorId: user.id,
          destinatarioId: profesorId,
          destinatarioEmail: profesor.email,
          destinatarioIdioma: profesor.idioma ?? null,
          variables: {
            nombre_destinatario: nombreProfesor,
            nombre_alumno: nombreAlumno,
            titulo_clase: horarioData?.titulo ?? horario?.titulo ?? '',
            fecha: horarioData?.fecha ?? '',
            hora_inicio: horarioData?.hora_inicio ?? '',
            hora_fin: horarioData?.hora_fin ?? '',
            enlace_clase: `${process.env.NEXT_PUBLIC_APP_URL}/horarios/${existing.horario_id}`,
          },
          horarioId: existing.horario_id,
          eventoId: `asistencia:${id}:${estado}`,
        };

        await sendNotificationEmail(solicitud);
      })().catch(() => {});
    }
  }

  return NextResponse.json(data);
}
