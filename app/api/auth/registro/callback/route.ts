import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendNotificationEmail } from '@/lib/email/emailService';
import { validarCodigo } from '@/lib/enlaces/acciones';
import { resolverProfesorAsociado } from '@/lib/enlaces/autorizacion';

/**
 * Callback de Google OAuth para el registro mediante enlace de invitación.
 * Valida el código ANTES de intercambiar el code de auth; tras el intercambio
 * asegura el rol del perfil, asocia alumno→profesor, consume el enlace de forma
 * atómica, dispara el correo y redirige al dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const authCode = searchParams.get('code');
  const inv = searchParams.get('inv');
  const oauthError = searchParams.get('error');

  const registroUrl = inv ? `${origin}/registro/${inv}` : `${origin}/login`;

  // Cancelación o fallo del proveedor.
  if (oauthError || !authCode || !inv) {
    return NextResponse.redirect(`${registroUrl}?error=google`);
  }

  const admin = createAdminClient();

  // ── 1. Validar el enlace ANTES de completar el registro ──
  const { data: enlace } = await admin
    .from('enlaces_invitacion')
    .select('id, tipo, estado, eliminado, profesor_asignado')
    .eq('codigo', inv)
    .maybeSingle();

  if (!validarCodigo(enlace)) {
    return NextResponse.redirect(`${registroUrl}?error=invalido`);
  }

  // ── 2. Intercambiar el code por una sesión (PKCE, SSR) ──
  const supabase = await createClient();
  const { data: sessionData, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(authCode);

  if (exchangeError || !sessionData?.user) {
    return NextResponse.redirect(`${registroUrl}?error=google`);
  }

  const userId = sessionData.user.id;
  const tipo = enlace!.tipo as 'profesor' | 'alumno' | 'lector';

  // ── 3. Asegurar rol del perfil y datos extra ──
  await admin.from('profiles').update({ rol: tipo }).eq('id', userId);

  if (tipo === 'alumno') {
    let profesorId: string | null = null;
    if (enlace!.profesor_asignado) {
      const { data: prof } = await admin
        .from('profiles')
        .select('id, rol, activo')
        .eq('id', enlace!.profesor_asignado)
        .maybeSingle();
      profesorId = resolverProfesorAsociado(prof);
    }
    // Upsert de alumnos_extra (puede existir si el trigger lo creó).
    const { data: existing } = await admin
      .from('alumnos_extra')
      .select('id')
      .eq('alumno_id', userId)
      .maybeSingle();
    if (!existing) {
      await admin.from('alumnos_extra').insert({ alumno_id: userId, profesor_id: profesorId } as never);
    } else if (profesorId) {
      await admin.from('alumnos_extra').update({ profesor_id: profesorId } as never).eq('alumno_id', userId);
    }
  }
  // tipo 'lector': no requiere datos extra

  // ── 4. Claim atómico del enlace ──
  const { data: claimed } = await admin
    .from('enlaces_invitacion')
    .update({ estado: 'usado', usuario_creado: userId, updated_at: new Date().toISOString() })
    .eq('id', enlace!.id)
    .eq('estado', 'activo')
    .eq('eliminado', false)
    .select('id');

  if (!claimed || claimed.length === 0) {
    // Carrera perdida: cerrar sesión y eliminar el usuario creado por este flujo.
    await supabase.auth.signOut();
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return NextResponse.redirect(`${registroUrl}?error=usado`);
  }

  // ── 5. Correo de bienvenida (fire-and-forget) ──
  const email = sessionData.user.email ?? '';
  if (email) {
    const meta = sessionData.user.user_metadata ?? {};
    const nombre = (meta.full_name as string) || (meta.name as string) || email;
    void sendNotificationEmail({
      tipo: 'invitacion_acceso',
      originadorId: userId,
      destinatarioId: userId,
      destinatarioEmail: email,
      destinatarioIdioma: null,
      variables: {
        nombre_destinatario: nombre,
        email_acceso: email,
        enlace_acceso: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
      },
      horarioId: null,
      eventoId: `registro:${userId}`,
    }).catch(() => {});
  }

  const redirectPath = tipo === 'profesor' ? '/profesor' : tipo === 'lector' ? '/lector' : '/alumno';
  return NextResponse.redirect(`${origin}${redirectPath}`);
}
