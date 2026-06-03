import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendNotificationEmail } from '@/lib/email/emailService';
import { buildEnlaceClase } from '@/lib/email/classLink';
import type { SolicitudCorreo } from '@/lib/email/types';

export async function POST(request: NextRequest) {
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

  if (!profile || profile.rol !== 'alumno') {
    return NextResponse.json({ error: 'Solo alumnos pueden crear solicitudes' }, { status: 403 });
  }

  const body = await request.json();
  const {
    horario_original_id,
    fecha_propuesta,
    hora_inicio_propuesta,
    hora_fin_propuesta,
    nota_alumno,
  } = body;

  // Validate required fields
  if (!horario_original_id || !fecha_propuesta || !hora_inicio_propuesta || !hora_fin_propuesta) {
    return NextResponse.json(
      { error: 'Campos requeridos: horario_original_id, fecha_propuesta, hora_inicio_propuesta, hora_fin_propuesta' },
      { status: 400 }
    );
  }

  // Fetch the original horario to get profesor_id and validate ownership
  const { data: horarioOriginal, error: horarioError } = await supabase
    .from('horarios')
    .select('id, profesor_id, alumno_id, titulo')
    .eq('id', horario_original_id)
    .single();

  if (horarioError || !horarioOriginal) {
    return NextResponse.json({ error: 'Horario original no encontrado' }, { status: 404 });
  }

  if (horarioOriginal.alumno_id !== user.id) {
    return NextResponse.json({ error: 'No autorizado para este horario' }, { status: 403 });
  }

  const profesorId = horarioOriginal.profesor_id;

  // Check for existing pending solicitud for the same horario_original_id
  const { data: existingSolicitud } = await supabase
    .from('solicitudes_cambio_horario')
    .select('id')
    .eq('horario_original_id', horario_original_id)
    .eq('estado', 'pendiente')
    .limit(1);

  if (existingSolicitud && existingSolicitud.length > 0) {
    return NextResponse.json(
      { error: 'Ya existe una solicitud pendiente para este horario' },
      { status: 409 }
    );
  }

  // Check profesor availability: overlapping active horarios on the same date
  const { data: conflictingHorarios } = await supabase
    .from('horarios')
    .select('id')
    .eq('profesor_id', profesorId)
    .eq('fecha', fecha_propuesta)
    .eq('activo', true)
    .lt('hora_inicio', hora_fin_propuesta)
    .gt('hora_fin', hora_inicio_propuesta);

  if (conflictingHorarios && conflictingHorarios.length > 0) {
    return NextResponse.json(
      { error: 'El horario propuesto no está disponible' },
      { status: 409 }
    );
  }

  // Check pending solicitudes for the same profesor at the same time
  const { data: conflictingSolicitudes } = await supabase
    .from('solicitudes_cambio_horario')
    .select('id')
    .eq('profesor_id', profesorId)
    .eq('fecha_propuesta', fecha_propuesta)
    .eq('estado', 'pendiente')
    .lt('hora_inicio_propuesta', hora_fin_propuesta)
    .gt('hora_fin_propuesta', hora_inicio_propuesta);

  if (conflictingSolicitudes && conflictingSolicitudes.length > 0) {
    return NextResponse.json(
      { error: 'El horario propuesto no está disponible' },
      { status: 409 }
    );
  }

  // Create the solicitud
  const { data: solicitud, error: insertError } = await supabase
    .from('solicitudes_cambio_horario')
    .insert({
      alumno_id: user.id,
      profesor_id: profesorId,
      horario_original_id,
      fecha_propuesta,
      hora_inicio_propuesta,
      hora_fin_propuesta,
      nota_alumno: nota_alumno || null,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Create notification for the profesor
  const { data: alumnoProfile } = await supabase
    .from('profiles')
    .select('nombre, apellido, apellido_materno')
    .eq('id', user.id)
    .single();

  const alumnoNombre = alumnoProfile
    ? [alumnoProfile.nombre, alumnoProfile.apellido, alumnoProfile.apellido_materno].filter(Boolean).join(' ')
    : 'Un alumno';

  await supabase.from('notificaciones').insert({
    destinatario_id: profesorId,
    tipo: 'solicitud_cambio_horario',
    mensaje: `${alumnoNombre} ha solicitado un cambio de horario para la clase "${horarioOriginal.titulo}"`,
    alumno_id: user.id,
    horario_id: horario_original_id,
    solicitud_id: solicitud.id,
  });

  // Disparo de correo `solicitud_cambio_horario` NO bloqueante (Requisito 15.1,
  // 15.2, 15.7): la respuesta de creación NO espera al correo, la notificación
  // realtime ya creada arriba se mantiene intacta, y cualquier fallo del correo
  // no revierte la solicitud (Requisito 15.6).
  void (async () => {
    // `createAdminClient()` (bypass RLS) para leer el email/idioma/nombre del
    // profesor destinatario, que el alumno no puede leer por RLS, y la
    // fecha/horas del horario original.
    const admin = createAdminClient();

    const { data: profesorProfile } = await admin
      .from('profiles')
      .select('email, idioma, nombre, apellido, rol')
      .eq('id', profesorId)
      .single();

    // Sin email del profesor no hay nada que enviar (Requisito 2).
    if (!profesorProfile?.email) {
      return;
    }

    // Datos del horario original para {fecha},{hora_inicio},{hora_fin},{titulo_clase},{descripcion_clase}.
    const { data: horarioData } = await admin
      .from('horarios')
      .select('titulo, descripcion, fecha, hora_inicio, hora_fin')
      .eq('id', horario_original_id)
      .single();

    const nombreProfesor = [profesorProfile.nombre, profesorProfile.apellido]
      .filter(Boolean)
      .join(' ')
      .trim();

    // El destinatario es el profesor propietario (o admin) → enlace a su vista de clase.
    const rolDestinatario = profesorProfile.rol === 'admin' ? 'admin' : 'profesor';

    const solicitudCorreo: SolicitudCorreo = {
      tipo: 'solicitud_cambio_horario',
      // El originador es el alumno; el destinatario y propietario de la plantilla
      // es el profesor propietario del horario (Requisito 15.3, 15.4).
      originadorId: user.id,
      destinatarioId: profesorId,
      destinatarioEmail: profesorProfile.email,
      destinatarioIdioma: profesorProfile.idioma,
      plantillaOwnerId: profesorId,
      variables: {
        nombre_destinatario: nombreProfesor,
        nombre_alumno: alumnoNombre,
        titulo_clase: horarioData?.titulo ?? horarioOriginal.titulo,
        descripcion_clase: horarioData?.descripcion ?? '',
        fecha: horarioData?.fecha ?? '',
        hora_inicio: horarioData?.hora_inicio?.slice(0, 5) ?? '',
        hora_fin: horarioData?.hora_fin?.slice(0, 5) ?? '',
        fecha_propuesta: solicitud.fecha_propuesta,
        hora_inicio_propuesta: solicitud.hora_inicio_propuesta?.slice(0, 5),
        hora_fin_propuesta: solicitud.hora_fin_propuesta?.slice(0, 5),
        nota_alumno: solicitud.nota_alumno ?? '',
        enlace_clase: buildEnlaceClase(horario_original_id, rolDestinatario),
      },
      horarioId: horario_original_id,
      eventoId: `solicitud:${solicitud.id}`,
    };

    await sendNotificationEmail(solicitudCorreo);
  })().catch(() => {});

  return NextResponse.json(solicitud, { status: 201 });
}

export async function GET(request: NextRequest) {
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

  if (!profile) {
    return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const estado = searchParams.get('estado');
  const horarioId = searchParams.get('horario_id');
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  let query = supabase
    .from('solicitudes_cambio_horario')
    .select(`
      *,
      alumno:profiles!solicitudes_cambio_horario_alumno_id_fkey(id, nombre, apellido),
      profesor:profiles!solicitudes_cambio_horario_profesor_id_fkey(id, nombre, apellido),
      horario_original:horarios!solicitudes_cambio_horario_horario_original_id_fkey(id, titulo, fecha, hora_inicio, hora_fin)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  // Filter by role
  if (profile.rol === 'alumno') {
    query = query.eq('alumno_id', user.id);
  } else if (profile.rol === 'profesor') {
    query = query.eq('profesor_id', user.id);
  }
  // admin sees all — no filter needed

  // Optional filters
  if (estado) {
    query = query.eq('estado', estado);
  }

  if (horarioId) {
    query = query.eq('horario_original_id', horarioId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
