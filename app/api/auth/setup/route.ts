import { NextRequest, NextResponse } from 'next/server';
import { createClient as createBrowserClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });

  const anonClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: invitation, error } = await anonClient
    .from('invitations')
    .select('email, used, expires_at')
    .eq('code', code)
    .single();

  if (error || !invitation) {
    return NextResponse.json({ error: 'Código inválido o no encontrado' }, { status: 404 });
  }

  return NextResponse.json(invitation);
}

export async function POST(request: NextRequest) {
  try {
    const { code, password } = await request.json();

    if (!code || !password) {
      return NextResponse.json({ error: 'Código y contraseña son requeridos' }, { status: 400 });
    }

    // Usamos el cliente anónimo (no el de servidor SSR) para no dañar las cookies si admin lo hace
    const anonClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // Búsqueda anónima de la invitación (asume política pública o permisos anon)
    const { data: invitation, error: invError } = await anonClient
      .from('invitations')
      .select('id, user_id, email, temp_password, expires_at, used')
      .eq('code', code)
      .single();

    if (invError || !invitation) {
      return NextResponse.json({ error: 'Código inválido o no encontrado' }, { status: 404 });
    }

    if (invitation.used) {
      return NextResponse.json({ error: 'Este enlace ya fue utilizado' }, { status: 400 });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Este enlace ha expirado' }, { status: 400 });
    }

    if (!invitation.temp_password) {
      return NextResponse.json({ error: 'No se puede procesar esta cuenta sin contraseña temporal registrada.' }, { status: 500 });
    }

    // Iniciar sesión temporal con la contraseña oculta
    const { error: signInError } = await anonClient.auth.signInWithPassword({
      email: invitation.email,
      password: invitation.temp_password
    });

    if (signInError) {
      return NextResponse.json({ error: 'Fallo al autenticar internamente para establecer la cuenta' }, { status: 500 });
    }

    // Actualizar la contraseña del usuario logueado
    const { error: updateError } = await anonClient.auth.updateUser({
      password: password
    });

    if (updateError) {
      return NextResponse.json({ error: 'No se pudo actualizar la contraseña' }, { status: 500 });
    }

    // Marcar como utilizada
    await anonClient
      .from('invitations')
      .update({ used: true })
      .eq('id', invitation.id);

    // Cerrar sesión
    await anonClient.auth.signOut();

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Error interno del servidor';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
