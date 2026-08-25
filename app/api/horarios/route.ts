import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendNotificationEmail } from '@/lib/email/emailService';
import { buildEnlaceClase } from '@/lib/email/classLink';
import { formatFechaEmail } from '@/lib/email/formatDate';
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
    .select('*, asistencia:asistencia!asistencia_horario_id_fkey(*), alumno:profiles!horarios_alumno_id_fkey(*), profesor:profiles!horarios_profesor_id_fkey(*), simulacion_comision(id, profesor_id, profesor:profiles!simulacion_comision_profesor_id_fkey(id, nombre, apellido, apellido_materno, avatar_url)), simulacion_evaluaciones(id, profesor_id, profesor:profiles!simulacion_evaluaciones_profesor_id_fkey(id, nombre, apellido, apellido_materno), nota, feedback, estado)')
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

  // Determine tipo_clase: explicit field takes precedence, fallback to es_prueba for backward compat
  const tipoClase: 'normal' | 'interrogacion' | 'simulacion' =
    body.tipo_clase || (body.es_prueba === true ? 'interrogacion' : 'normal');

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
      enlace_conexion: body.enlace_conexion || null,
      es_recurrente: false,
      activo: true,
      tipo_clase: tipoClase,
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

  // If marked as exam (interrogacion), create a linked prueba record
  if (tipoClase === 'interrogacion') {
    await supabase.from('pruebas').insert({
      alumno_id: body.alumno_id,
      profesor_id: profesorId,
      horario_id: horario.id,
      nombre: body.titulo,
      fecha: body.fecha,
      estado: 'pendiente',
    });
  }

  // If simulacion, create comision and evaluaciones records
  if (tipoClase === 'simulacion') {
    // Build deduplicated comision: profesor responsable + selected ids
    const comisionSet = new Set<string>([profesorId, ...(body.comision_ids || [])]);
    const comisionIds = Array.from(comisionSet);

    // Insert comision members
    const comisionRows = comisionIds.map((pid: string) => ({
      horario_id: horario.id,
      profesor_id: pid,
    }));
    await supabase.from('simulacion_comision').insert(comisionRows);

    // Insert pending evaluaciones for each comision member
    const evaluacionRows = comisionIds.map((pid: string) => ({
      horario_id: horario.id,
      profesor_id: pid,
      estado: 'pendiente',
    }));
    await supabase.from('simulacion_evaluaciones').insert(evaluacionRows);
  }

  // Envía el correo `nueva_clase` al alumno de forma NO bloqueante (fire-and-forget).
  // La respuesta se envía de inmediato; el correo se procesa en background.
  // Se incluye `email_intentado` para que el frontend muestre un toast optimista.
  let emailIntentado = false;

  const admin = createAdminClient();

  // Check if the professor/admin has email sending enabled
  const { data: originadorProfile } = await admin
    .from('profiles')
    .select('enviar_correo_al_asignar')
    .eq('id', profesorId)
    .single();

  if (originadorProfile?.enviar_correo_al_asignar !== false) {
    emailIntentado = true;

    // Fire-and-forget: no await, no blocking
    void (async () => {
      try {
        const { data: alumno } = await admin
          .from('profiles')
          .select('email, idioma, nombre, apellido, apellido_materno')
          .eq('id', body.alumno_id)
          .single();
        if (!alumno?.email) return;

        const nombreAlumno = [alumno.nombre, alumno.apellido, alumno.apellido_materno].filter(Boolean).join(' ').trim();

        // For simulacion, fetch commission professor names
        let comisionNames = '';
        if (tipoClase === 'simulacion') {
          const { data: comision } = await admin
            .from('simulacion_comision')
            .select('profesor:profiles!simulacion_comision_profesor_id_fkey(nombre, apellido, apellido_materno)')
            .eq('horario_id', horario.id);
          if (comision) {
            comisionNames = comision
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((c: any) => [c.profesor?.nombre, c.profesor?.apellido, c.profesor?.apellido_materno].filter(Boolean).join(' '))
              .join(', ');
          }
        }

        const solicitud: SolicitudCorreo = {
          tipo: tipoClase === 'simulacion' ? 'nueva_simulacion' : 'nueva_clase',
          originadorId: profesorId,
          destinatarioId: body.alumno_id,
          destinatarioEmail: alumno.email,
          destinatarioIdioma: alumno.idioma,
          variables: {
            nombre_destinatario: nombreAlumno,
            nombre_alumno: nombreAlumno,
            titulo_clase: horario.titulo,
            descripcion_clase: horario.descripcion ?? '',
            fecha: formatFechaEmail(horario.fecha),
            hora_inicio: horario.hora_inicio?.slice(0, 5) ?? '',
            hora_fin: horario.hora_fin?.slice(0, 5) ?? '',
            enlace_clase: buildEnlaceClase(horario.id, 'alumno'),
            ...(tipoClase === 'simulacion' ? {
              comision_profesores: comisionNames,
              enlace_conexion: body.enlace_conexion || '',
            } : {}),
          },
          horarioId: horario.id,
          eventoId: `${tipoClase === 'simulacion' ? 'nueva_simulacion' : 'nueva_clase'}:${horario.id}`,
        };

        const resultado = await sendNotificationEmail(solicitud);

        // Register in email_recordatorios so it counts in the reminder counter
        if (resultado === 'enviado') {
          await admin.from('email_recordatorios').insert({
            horario_id: horario.id,
            alumno_id: body.alumno_id,
            enviado_por: user!.id,
          });
        }
      } catch {
        // Email failure is non-fatal
      }
    })();
  }

  return NextResponse.json({ ...horario, email_intentado: emailIntentado }, { status: 201 });
}
