import 'server-only';
import { getLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { getRolRedirectPath } from '@/lib/auth/helpers';
import type { LandingProps } from './types';

/**
 * Resuelve el contexto común que todas las páginas del landing necesitan:
 * locale activo, ruta del CTA (dashboard si hay sesión, /login si no) y si el
 * usuario está logeado. Se ejecuta en el servidor.
 */
export async function getLandingContext(): Promise<LandingProps> {
  const locale = await getLocale();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let dashboardPath: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (profile) {
      dashboardPath = getRolRedirectPath(profile.rol);
    }
  }

  return {
    locale,
    ctaHref: dashboardPath ?? '/login',
    isLoggedIn: dashboardPath !== null,
  };
}
