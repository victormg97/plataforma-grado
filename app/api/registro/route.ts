import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendNotificationEmail } from '@/lib/email/emailService';
import { validarCodigo } from '@/lib/enlaces/acciones';
import { resolverProfesorAsociado } from '@/lib/enlaces/autorizacion';
import {
  registroEsValido,
  type RegistroFormData,
  type TipoRegistro,
} from '@/lib/validations/registro';

/**
 * POST público: registro manual mediante un enlace de invitación.
 * Valida el código en servidor (service role), crea la cuenta, consume el enlace
 * de forma atómica (claim condicional), establece sesión y dispara el correo de
 * bienvenida (fire-and-forget).
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.code !== 'string') {
    return NextResponse.json({ error: 'VALIDACION' }, { status: 422 });
  }

  const code: string = body.code;
  const form: Partial<RegistroFormData> = body.datos ?? {};

  const admin = createAdminClient();

  // ── 1. Validar el enlace ──
  const { data: enlace } = await admin
    .from('enlaces_invitacion')
    .select('id, tipo, estado, eliminado, profesor_asignado')
    .eq('codigo', code)
    .maybeSingle();

  if (!validarCodigo(enlace)) {
    return NextResponse.json({ error: 'ENLACE_NO_DISPONIBLE' }, { status: 409 });
  }

  const tipo = enlace!.tipo as TipoRegistro;

  // ── 2. Validar entrada (misma regla que el cliente) ──
  if (!registroEsValido(form, tipo)) {
    return NextResponse.json({ error: 'VALIDACION' }, { status: 422 });
  }

  const nombre = (form.nombre ?? '').trim();
  const apellido = (form.apellido ?? '').trim();
  const email = (form.email ?? '').trim().toLowerCase();
  const password = form.password ?? '';

  // ── 3. Crear el usuario en Auth (service role, email confirmado) ──
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre, apellido, rol: tipo },
  });

  if (createError || !created?.user) {
    const yaExiste =
      createError?.message?.toLowerCase().includes('already') ||
      createError?.code === 'email_exists';
    if (yaExiste) {
      return NextResponse.json({ error: 'EMAIL_EN_USO' }, { status: 409 });
    }
    return NextResponse.json({ error: 'REGISTRO_FALLIDO', message: createError?.message }, { status: 500 });
  }

  const userId = created.user.id;

  // Compensación: elimina el usuario recién creado ante un fallo posterior.
  const revertir = async () => {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  };

  // ── 4. Completar perfil y datos extra ──
  const profileUpdates: Record<string, string> = {};
  if (form.apellido_materno?.trim()) profileUpdates.apellido_materno = form.apellido_materno.trim();
  if (form.telefono?.trim()) profileUpdates.telefono = form.telefono.trim();
  if (Object.keys(profileUpdates).length > 0) {
    await admin.from('profiles').update(profileUpdates).eq('id', userId);
  }

  if (tipo === 'alumno') {
    // Resolver el profesor asociado solo si sigue válido y activo.
    let profesorId: string | null = null;
    if (enlace!.profesor_asignado) {
      const { data: prof } = await admin
        .from('profiles')
        .select('id, rol, activo')
        .eq('id', enlace!.profesor_asignado)
        .maybeSingle();
      profesorId = resolverProfesorAsociado(prof);
    }

    const { error: extraError } = await admin.from('alumnos_extra').insert({
      alumno_id: userId,
      profesor_id: profesorId,
      universidad: form.universidad?.trim() || null,
      ['año_egreso']: form['año_egreso']?.trim() || null,
    } as never);

    if (extraError) {
      await revertir();
      return NextResponse.json({ error: 'REGISTRO_FALLIDO', message: extraError.message }, { status: 500 });
    }
  }

  // ── 5. Claim atómico del enlace (activo -> usado) ──
  const { data: claimed, error: claimError } = await admin
    .from('enlaces_invitacion')
    .update({ estado: 'usado', usuario_creado: userId, updated_at: new Date().toISOString() })
    .eq('id', enlace!.id)
    .eq('estado', 'activo')
    .eq('eliminado', false)
    .select('id');

  if (claimError) {
    await revertir();
    return NextResponse.json({ error: 'REGISTRO_FALLIDO', message: claimError.message }, { status: 500 });
  }
  if (!claimed || claimed.length === 0) {
    // Carrera perdida o enlace ya no activo: compensar.
    await revertir();
    return NextResponse.json({ error: 'ENLACE_USADO' }, { status: 409 });
  }

  // ── 6. Establecer sesión (cookies SSR) ──
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    // La cuenta y el consumo persisten; el usuario puede iniciar sesión luego.
    return NextResponse.json(
      { ok: true, redirectPath: '/login', warning: 'SESION_NO_ESTABLECIDA' },
      { status: 200 },
    );
  }

  // ── 7. Correo de bienvenida (fire-and-forget; un fallo no revierte nada) ──
  void sendNotificationEmail({
    tipo: 'invitacion_acceso',
    originadorId: userId,
    destinatarioId: userId,
    destinatarioEmail: email,
    destinatarioIdioma: null,
    variables: {
      nombre_destinatario: `${nombre} ${apellido}`.trim(),
      email_acceso: email,
      enlace_acceso: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
    },
    horarioId: null,
    eventoId: `registro:${userId}`,
  }).catch(() => {});

  const redirectPath = tipo === 'profesor' ? '/profesor' : '/alumno';
  return NextResponse.json({ ok: true, redirectPath }, { status: 200 });
}
