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

  // Dispara el correo `nueva_clase` al alumno de forma NO bloqueante
  // (fire-and-forget). La respuesta de creación no espera al correo y un fallo
  // de envío no revierte el horario ya persistido (Requisito 18.1, 18.6, 18.7).
  void (async () => {
    const admin = createAdminClient();
    const { data: alumno } = await admin
      .from('profiles')
      .select('email, idioma, nombre, apellido')
      .eq('id', body.alumno_id)
      .single();
    if (!alumno?.email) return;

    const nombreAlumno = `${alumno.nombre ?? ''} ${alumno.apellido ?? ''}`.trim();

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
        hora_inicio: horario.hora_inicio,
        hora_fin: horario.hora_fin,
        // El destinatario es el alumno → enlace a la vista de la clase del alumno.
        enlace_clase: buildEnlaceClase(horario.id, 'alumno'),
      },
      horarioId: horario.id,
      eventoId: `nueva_clase:${horario.id}`,
    };

    await sendNotificationEmail(solicitud);
  })().catch(() => {});

  return NextResponse.json(horario, { status: 201 });
}
