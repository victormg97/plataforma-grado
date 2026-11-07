import 'server-only';
import { getLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { getRolRedirectPath } from '@/lib/auth/helpers';
import type { LandingProps } from './types';

/**
 * Si el landing vive en www. y la plataforma en app. (NEXT_PUBLIC_APP_HOST),
 * devuelve una URL absoluta al host de la plataforma. Asi el <Link> no hace
 * prefetch RSC cross-origin (que fallaba por CORS). Sin APP_HOST, ruta relativa.
 */
function platformHref(path: string): string {
  const appHost = process.env.NEXT_PUBLIC_APP_HOST;
  return appHost ? `https://${appHost}${path}` : path;
}

/**
 * Resuelve el contexto común que todas las páginas del landing necesitan:
 * locale activo, ruta del CTA (dashboard si hay sesión, /login si no) y si el
 * usuario está logeado. Se ejecuta en el servidor.
 */
export async function getLandingContext(): Promise<LandingProps> {
  const locale = await getLocale();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fast path: most landing visitors are anonymous — skip profile lookup
  if (!user) {
    return { locale, ctaHref: platformHref('/login'), isLoggedIn: false };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  const dashboardPath = profile ? getRolRedirectPath(profile.rol) : null;

  return {
    locale,
    ctaHref: platformHref(dashboardPath ?? '/login'),
    isLoggedIn: dashboardPath !== null,
  };
}
