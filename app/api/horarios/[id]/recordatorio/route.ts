import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendNotificationEmail } from '@/lib/email/emailService';
import { buildEnlaceClase } from '@/lib/email/classLink';
import type { SolicitudCorreo } from '@/lib/email/types';

/**
 * POST /api/horarios/[id]/recordatorio
 *
 * Envía un correo de recordatorio de clase al alumno asignado.
 * Solo profesor (dueño del horario) o admin pueden hacerlo.
 *
 * Anti-spam: verifica que hayan pasado al menos `recordatorio_cooldown_minutos`
 * desde el último recordatorio enviado para esta combinación clase+alumno.
 *
 * Registra el envío en `email_recordatorios` para el contador y el cooldown.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: horarioId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // Verify role
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.rol !== 'profesor' && profile.rol !== 'admin')) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  // Fetch the horario with student data
  const admin = createAdminClient();
  const { data: horario, error: horarioError } = await admin
    .from('horarios')
    .select('id, titulo, descripcion, fecha, hora_inicio, hora_fin, alumno_id, profesor_id, activo')
    .eq('id', horarioId)
    .single();

  if (horarioError || !horario) {
    return NextResponse.json({ error: 'Clase no encontrada' }, { status: 404 });
  }

  // Authorization: only the owning profesor or admin can send
  if (profile.rol === 'profesor' && horario.profesor_id !== user.id) {
    return NextResponse.json({ error: 'Sin permisos sobre esta clase' }, { status: 403 });
  }

  // Block reminders for past classes
  const claseDatetime = new Date(`${horario.fecha}T${horario.hora_fin}`);
  if (claseDatetime < new Date()) {
    return NextResponse.json({ error: 'clase_pasada' }, { status: 400 });
  }

  // Get the cooldown setting from the admin (first admin found or the requesting user)
  const { data: adminSettings } = await admin
    .from('profiles')
    .select('recordatorio_cooldown_minutos')
    .eq('rol', 'admin')
    .limit(1)
    .single();

  const cooldownMinutos = adminSettings?.recordatorio_cooldown_minutos ?? 60;

  // Check cooldown: look for the last reminder sent for this class+student
  const { data: lastReminder } = await admin
    .from('email_recordatorios')
    .select('created_at')
    .eq('horario_id', horarioId)
    .eq('alumno_id', horario.alumno_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastReminder) {
    const lastSentAt = new Date(lastReminder.created_at);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastSentAt.getTime()) / (1000 * 60);

    if (diffMinutes < cooldownMinutos) {
      const minutosRestantes = Math.ceil(cooldownMinutos - diffMinutes);
      return NextResponse.json(
        { error: 'cooldown', minutos_restantes: minutosRestantes },
        { status: 429 }
      );
    }
  }

  // Fetch student profile
  const { data: alumno } = await admin
    .from('profiles')
    .select('email, idioma, nombre, apellido, apellido_materno')
    .eq('id', horario.alumno_id)
    .single();

  if (!alumno?.email) {
    return NextResponse.json({ error: 'Alumno sin correo' }, { status: 400 });
  }

  const nombreAlumno = [alumno.nombre, alumno.apellido, alumno.apellido_materno]
    .filter(Boolean).join(' ').trim();

  // Send the reminder email
  const solicitud: SolicitudCorreo = {
    tipo: 'recordatorio_clase',
    originadorId: user.id,
    destinatarioId: horario.alumno_id,
    destinatarioEmail: alumno.email,
    destinatarioIdioma: alumno.idioma,
    variables: {
      nombre_destinatario: nombreAlumno,
      nombre_alumno: nombreAlumno,
      titulo_clase: horario.titulo,
      descripcion_clase: horario.descripcion ?? '',
      fecha: horario.fecha,
      hora_inicio: horario.hora_inicio?.slice(0, 5) ?? '',
      hora_fin: horario.hora_fin?.slice(0, 5) ?? '',
      enlace_clase: buildEnlaceClase(horario.id, 'alumno'),
    },
    horarioId: horario.id,
    // Use a unique event ID that includes a timestamp to allow multiple reminders
    // (the deduplication in emailService uses evento_id + destinatario_id)
    eventoId: `recordatorio_clase:${horario.id}:${Date.now()}`,
  };

  const resultado = await sendNotificationEmail(solicitud);

  if (resultado === 'enviado') {
    // Record the reminder in email_recordatorios
    await admin.from('email_recordatorios').insert({
      horario_id: horarioId,
      alumno_id: horario.alumno_id,
      enviado_por: user.id,
    });
  }

  // Get updated count
  const { count } = await admin
    .from('email_recordatorios')
    .select('*', { count: 'exact', head: true })
    .eq('horario_id', horarioId)
    .eq('alumno_id', horario.alumno_id);

  return NextResponse.json({
    resultado,
    total_enviados: count ?? 0,
  });
}

/**
 * GET /api/horarios/[id]/recordatorio
 *
 * Returns the reminder count and cooldown status for a specific class.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: horarioId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.rol !== 'profesor' && profile.rol !== 'admin')) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const admin = createAdminClient();

  // Get the horario to know the alumno_id
  const { data: horario } = await admin
    .from('horarios')
    .select('alumno_id, fecha, hora_fin')
    .eq('id', horarioId)
    .single();

  if (!horario) {
    return NextResponse.json({ error: 'Clase no encontrada' }, { status: 404 });
  }

  // Check if class is in the past
  const claseDatetime = new Date(`${horario.fecha}T${horario.hora_fin}`);
  const clasePasada = claseDatetime < new Date();

  // Get cooldown from admin
  const { data: adminSettings } = await admin
    .from('profiles')
    .select('recordatorio_cooldown_minutos')
    .eq('rol', 'admin')
    .limit(1)
    .single();

  const cooldownMinutos = adminSettings?.recordatorio_cooldown_minutos ?? 60;

  // Get total count
  const { count } = await admin
    .from('email_recordatorios')
    .select('*', { count: 'exact', head: true })
    .eq('horario_id', horarioId)
    .eq('alumno_id', horario.alumno_id);

  // Get last sent time
  const { data: lastReminder } = await admin
    .from('email_recordatorios')
    .select('created_at')
    .eq('horario_id', horarioId)
    .eq('alumno_id', horario.alumno_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let puede_enviar = true;
  let minutos_restantes = 0;

  if (lastReminder) {
    const lastSentAt = new Date(lastReminder.created_at);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastSentAt.getTime()) / (1000 * 60);

    if (diffMinutes < cooldownMinutos) {
      puede_enviar = false;
      minutos_restantes = Math.ceil(cooldownMinutos - diffMinutes);
    }
  }

  return NextResponse.json({
    total_enviados: count ?? 0,
    puede_enviar: puede_enviar && !clasePasada,
    minutos_restantes,
    cooldown_minutos: cooldownMinutos,
    clase_pasada: clasePasada,
  });
}
