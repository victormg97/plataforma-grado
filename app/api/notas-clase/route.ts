import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendNotificationEmail } from '@/lib/email/emailService';

// GET /api/notas-clase?horario_id=xxx
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const horarioId = request.nextUrl.searchParams.get('horario_id');
  if (!horarioId) {
    return NextResponse.json({ error: 'horario_id requerido' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('get_notas_clase', { p_horario_id: horarioId });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/notas-clase
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await request.json();
  const { horario_id, contenido } = body;

  if (!horario_id || !contenido?.trim()) {
    return NextResponse.json({ error: 'horario_id y contenido son requeridos' }, { status: 400 });
  }

  // Verify user has access to this class
  const { data: horario } = await supabase
    .from('horarios')
    .select('id, alumno_id, profesor_id')
    .eq('id', horario_id)
    .single();

  if (!horario) {
    return NextResponse.json({ error: 'Horario no encontrado' }, { status: 404 });
  }

  // Check user is part of this class or is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (
    horario.alumno_id !== user.id &&
    horario.profesor_id !== user.id &&
    profile?.rol !== 'admin'
  ) {
    return NextResponse.json({ error: 'No autorizado para esta clase' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('notas_clase')
    .insert({
      horario_id,
      autor_id: user.id,
      contenido: contenido.trim(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ── Create notifications for other participants ──────────────────────────
  // Determine who should be notified (everyone involved except the author)
  const destinatarios: string[] = [];

  // Always notify the student if the author is not the student
  if (horario.alumno_id && horario.alumno_id !== user.id) {
    destinatarios.push(horario.alumno_id);
  }

  // Always notify the professor if the author is not the professor
  if (horario.profesor_id && horario.profesor_id !== user.id) {
    destinatarios.push(horario.profesor_id);
  }

  // If author is the student or professor, also notify admins
  if (profile?.rol !== 'admin') {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('rol', 'admin');
    if (admins) {
      for (const admin of admins) {
        if (admin.id !== user.id && !destinatarios.includes(admin.id)) {
          destinatarios.push(admin.id);
        }
      }
    }
  }

  // Get author name for the notification message
  const { data: autorProfile } = await supabase
    .from('profiles')
    .select('nombre, apellido')
    .eq('id', user.id)
    .single();

  const autorNombre = autorProfile
    ? `${autorProfile.nombre} ${autorProfile.apellido}`.trim()
    : 'Un usuario';

  // Build a short snippet of the note content (strip HTML, max 60 chars)
  const snippet = contenido
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);

  const mensaje = `${autorNombre} dejó una nota: "${snippet}${contenido.replace(/<[^>]*>/g, '').trim().length > 60 ? '…' : ''}"`;

  // Insert notifications for all destinatarios
  if (destinatarios.length > 0) {
    const notificaciones = destinatarios.map((destinatario_id) => ({
      destinatario_id,
      tipo: 'nueva_nota_clase' as const,
      mensaje,
      horario_id,
      nota_clase_id: data.id,
      alumno_id: horario.alumno_id,
    }));

    await supabase.from('notificaciones').insert(notificaciones);
  }

  // ── Send email to student when note is from profesor/admin ────────────────
  // One-way: only profesor/admin → alumno triggers email, not alumno → profesor
  if (
    (profile?.rol === 'profesor' || profile?.rol === 'admin') &&
    horario.alumno_id &&
    horario.alumno_id !== user.id
  ) {
    // Get student profile for email and language
    const { data: alumnoProfile } = await supabase
      .from('profiles')
      .select('email, nombre, apellido, idioma')
      .eq('id', horario.alumno_id)
      .single();

    if (alumnoProfile) {
      // Get class details for the email
      const { data: horarioDetail } = await supabase
        .from('horarios')
        .select('titulo, fecha, hora_inicio, hora_fin')
        .eq('id', horario_id)
        .single();

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
      // Link goes directly to the class with the note highlighted
      const enlaceClase = `${appUrl}/alumno/horario?id=${horario_id}&nota_id=${data.id}`;

      // Strip HTML for a plain-text-ish version, but keep it for the email body highlight
      const contenidoParaCorreo = contenido
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .trim();

      void sendNotificationEmail({
        tipo: 'nueva_nota_clase',
        originadorId: user.id,
        destinatarioId: horario.alumno_id,
        destinatarioEmail: alumnoProfile.email,
        destinatarioIdioma: alumnoProfile.idioma,
        variables: {
          nombre_destinatario: `${alumnoProfile.nombre} ${alumnoProfile.apellido}`.trim(),
          nombre_autor: autorNombre,
          contenido_nota: contenidoParaCorreo,
          titulo_clase: horarioDetail?.titulo ?? '',
          fecha: horarioDetail?.fecha ?? '',
          hora_inicio: horarioDetail?.hora_inicio?.slice(0, 5) ?? '',
          hora_fin: horarioDetail?.hora_fin?.slice(0, 5) ?? '',
          enlace_clase: enlaceClase,
        },
        horarioId: horario_id,
        eventoId: `nueva_nota_clase:${data.id}`,
      }).catch(() => {});
    }
  }

  return NextResponse.json(data, { status: 201 });
}
