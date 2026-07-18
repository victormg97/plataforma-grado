import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendNotificationEmail } from '@/lib/email/emailService';
import { buildEnlaceClase } from '@/lib/email/classLink';
import type { SolicitudCorreo } from '@/lib/email/types';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const fecha = request.nextUrl.searchParams.get('fecha');

  // Fetch profile role (minimal select) and build query
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });
  }

  let query = supabase
    .from('horarios')
    .select('*, asistencia:asistencia!asistencia_horario_id_fkey(*), alumno:profiles!horarios_alumno_id_fkey(*), profesor:profiles!horarios_profesor_id_fkey(*)')
    .eq('activo', true);

  if (fecha) {
    query = query.eq('fecha', fecha);
  }

  if (profile.rol === 'profesor') {
    query = query.eq('profesor_id', user.id);
  } else if (profile.rol === 'alumno') {
    query = query.eq('alumno_id', user.id);
  }

  const { data, error } = await query.order('hora_inicio', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await request.json();

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  const profesorId = (profile?.rol === 'admin' && body.profesor_id) ? body.profesor_id : user.id;

  const { data: horario, error: horarioError } = await supabase
    .from('horarios')
    .insert({
      profesor_id: profesorId,
      alumno_id: body.alumno_id,
      titulo: body.titulo,
      descripcion: body.descripcion || null,
      fecha: body.fecha,
      hora_inicio: body.hora_inicio,
      hora_fin: body.hora_fin,
      es_recurrente: false,
      activo: true,
    })
    .select()
    .single();

  if (horarioError) {
    return NextResponse.json({ error: horarioError.message }, { status: 500 });
  }

  // Create attendance record as pending
  await supabase.from('asistencia').insert({
    horario_id: horario.id,
    alumno_id: body.alumno_id,
    estado: 'pendiente' as const,
    nuevo_horario_id: null,
    nota_alumno: null,
  });

  // If marked as exam, create a linked prueba record
  if (body.es_prueba === true) {
    await supabase.from('pruebas').insert({
      alumno_id: body.alumno_id,
      profesor_id: profesorId,
      horario_id: horario.id,
      nombre: body.titulo,
      fecha: body.fecha,
      estado: 'pendiente',
    });
  }

  // Envía el correo `nueva_clase` al alumno y registra el resultado.
  // Se espera al resultado para informar al usuario si el correo fue enviado.
  let emailEnviado = false;

  try {
    const admin = createAdminClient();

    // Check if the professor/admin has email sending enabled
    const { data: originadorProfile } = await admin
      .from('profiles')
      .select('enviar_correo_al_asignar')
      .eq('id', profesorId)
      .single();

    if (originadorProfile?.enviar_correo_al_asignar !== false) {
      const { data: alumno } = await admin
        .from('profiles')
        .select('email, idioma, nombre, apellido, apellido_materno')
        .eq('id', body.alumno_id)
        .single();

      if (alumno?.email) {
        const nombreAlumno = [alumno.nombre, alumno.apellido, alumno.apellido_materno].filter(Boolean).join(' ').trim();

        const solicitud: SolicitudCorreo = {
          tipo: 'nueva_clase',
          originadorId: profesorId,
          destinatarioId: body.alumno_id,
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
          eventoId: `nueva_clase:${horario.id}`,
        };

        const resultado = await sendNotificationEmail(solicitud);
        emailEnviado = resultado === 'enviado';

        // Register in email_recordatorios so it counts in the reminder counter
        if (emailEnviado) {
          await admin.from('email_recordatorios').insert({
            horario_id: horario.id,
            alumno_id: body.alumno_id,
            enviado_por: user.id,
          });
        }
      }
    }
  } catch {
    // Email failure never blocks class creation
  }

  return NextResponse.json({ ...horario, email_enviado: emailEnviado }, { status: 201 });
}
