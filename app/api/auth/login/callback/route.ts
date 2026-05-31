import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Callback de Google OAuth para INICIO DE SESIÓN (no registro).
 *
 * Seguridad: el OAuth de Supabase crea la cuenta automáticamente si el correo no
 * existe. Para que el login con Google NO sea una puerta de auto-registro que se
 * salte el sistema de invitaciones, este callback solo permite continuar a
 * usuarios que YA tenían un perfil previo. Si el intercambio crea un usuario
 * nuevo (sin perfil y recién creado), se cierra la sesión y se elimina la cuenta.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const authCode = searchParams.get('code');
  const oauthError = searchParams.get('error');

  if (oauthError || !authCode) {
    return NextResponse.redirect(`${origin}/login?error=google`);
  }

  const supabase = await createClient();
  const { data: sessionData, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(authCode);

  if (exchangeError || !sessionData?.user) {
    return NextResponse.redirect(`${origin}/login?error=google`);
  }

  const user = sessionData.user;
  const admin = createAdminClient();

  // ¿Existe un perfil para este usuario?
  const { data: profile } = await admin
    .from('profiles')
    .select('id, rol, activo')
    .eq('id', user.id)
    .maybeSingle();

  // Determinar si la cuenta de Auth se acaba de crear en este intercambio.
  // Si created_at y last_sign_in_at son (casi) iguales, es un registro nuevo.
  const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0;
  const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : createdAt;
  const esCuentaNueva = Math.abs(lastSignIn - createdAt) < 5000;

  if (!profile || esCuentaNueva) {
    // Usuario no invitado intentando entrar por Google → revertir.
    await supabase.auth.signOut();
    // Solo eliminamos si realmente es una cuenta nueva sin perfil, para no
    // borrar nunca una cuenta legítima preexistente.
    if (!profile) {
      await admin.auth.admin.deleteUser(user.id).catch(() => {});
    }
    return NextResponse.redirect(`${origin}/login?error=google_sin_cuenta`);
  }

  // Cuenta bloqueada
  if (profile.activo === false) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?blocked=1`);
  }

  const redirectMap: Record<string, string> = {
    admin: '/admin',
    profesor: '/profesor',
    alumno: '/alumno',
  };
  return NextResponse.redirect(`${origin}${redirectMap[profile.rol] ?? '/login'}`);
}
