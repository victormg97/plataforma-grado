import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { checkApiRateLimit, getIp, tooManyRequestsResponse } from '@/lib/utils/rateLimit';
import { tenantConfig } from '@/config';

// ── Separación de dominios (Opción 1: un deploy, dos hosts) ──────────────────
// El landing público vive en `www.<dominio>` y la plataforma (todo lo que
// requiere sesión) en `app.<dominio>`, ambos apuntando al MISMO deploy. Aquí
// redirigimos por hostname ANTES de la lógica de auth para que cada URL viva en
// su subdominio correcto. Se desactiva en localhost / previews / si no hay
// NEXT_PUBLIC_APP_HOST (todo convive en un host como antes).

// Rutas que pertenecen a la plataforma (deben vivir en app.).
const PLATFORM_PREFIXES = [
  '/login',
  '/setup',
  '/registro',
  '/admin',
  '/profesor',
  '/alumno',
  '/lector',
  '/perfil',
  '/comunidad',
  '/recursos',
  '/enlaces-invitacion',
  '/pagina',
];

// Rutas que pertenecen al landing público (deben vivir en www).
const LANDING_PREFIXES = [
  '/landing',
  '/programas',
  '/tutorias',
  '/planes',
  '/sobre-nosotras',
  '/contacto',
  '/acerca-de',
];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Devuelve una redirección al subdominio correcto si aplica, o null para dejar
 * que el request continúe en el host actual.
 */
function resolveHostRedirect(request: NextRequest): NextResponse | null {
  const appHost = process.env.NEXT_PUBLIC_APP_HOST?.toLowerCase();
  if (!appHost) return null;

  // No redirigir peticiones RSC (navegación/prefetch interno de Next.js). Estas
  // viajan como fetch con la cabecera `RSC: 1`; un redirect cross-origin (app. →
  // www.) las hace fallar por CORS ("Redirect is not allowed for a preflight
  // request"). La redirección de host sólo tiene sentido para navegaciones de
  // documento completo, no para los data-fetches internos del App Router.
  if (request.headers.get('rsc') === '1' || request.nextUrl.searchParams.has('_rsc')) {
    return null;
  }

  const host = request.headers.get('host')?.toLowerCase() ?? '';
  if (
    host.startsWith('localhost') ||
    host.startsWith('127.0.0.1') ||
    host.endsWith('.vercel.app')
  ) {
    return null;
  }

  const { pathname, search } = request.nextUrl;
  const wwwHost = appHost.replace(/^app\./, 'www.');

  if (host === appHost) {
    // En app.: la raíz y las rutas de landing se mandan a www.
    if (pathname === '/') {
      return NextResponse.redirect(`https://${wwwHost}/`, 308);
    }
    if (matchesPrefix(pathname, LANDING_PREFIXES)) {
      return NextResponse.redirect(`https://${wwwHost}${pathname}${search}`, 308);
    }
    return null;
  }

  // En www (u otro host): las rutas de plataforma se mandan a app.
  if (matchesPrefix(pathname, PLATFORM_PREFIXES)) {
    return NextResponse.redirect(`https://${appHost}${pathname}${search}`, 308);
  }

  return null;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Separación de dominios primero: si la URL no corresponde a este host,
  // redirige al subdominio correcto antes de tocar auth/rate-limit.
  const hostRedirect = resolveHostRedirect(request);
  if (hostRedirect) return hostRedirect;

  // ── Rate limit: /api/* (except /api/auth/login which has its own stricter limiter) ──
  if (pathname.startsWith('/api/') && pathname !== '/api/auth/login') {
    const ip = getIp(request);
    const result = await checkApiRateLimit(ip);
    if (!result.allowed) {
      return tooManyRequestsResponse(result.retryAfterSeconds, 'RATE_LIMITED');
    }
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const landingHabilitado = tenantConfig.landingPage?.habilitado === true;
  const usuarioLogeadoVeLanding = tenantConfig.landingPage?.usuarioLogeadoVeLanding === true;

  // ── Ruta raíz "/" ──────────────────────────────────────────────────────────
  if (pathname === '/') {
    if (landingHabilitado) {
      // Tenant con landing page
      if (user && !usuarioLogeadoVeLanding) {
        // Usuario logeado + tenant prefiere mandarlo directo al dashboard
        const { data: profile } = await supabase
          .from('profiles')
          .select('rol')
          .eq('id', user.id)
          .single();

        if (profile) {
          const redirectMap: Record<string, string> = {
            admin: '/admin',
            profesor: '/profesor',
            alumno: '/alumno',
            lector: '/lector',
          };
          const url = request.nextUrl.clone();
          url.pathname = redirectMap[profile.rol] || '/login';
          return NextResponse.redirect(url);
        }
      }
      // Mostrar el landing (usuario logeado que puede verlo, o no logeado)
      const url = request.nextUrl.clone();
      url.pathname = '/landing';
      return NextResponse.redirect(url);
    }

    // Tenant sin landing page: comportamiento original
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .single();

      if (profile) {
        const redirectMap: Record<string, string> = {
          admin: '/admin',
          profesor: '/profesor',
          alumno: '/alumno',
          lector: '/lector',
        };
        const url = request.nextUrl.clone();
        url.pathname = redirectMap[profile.rol] || '/login';
        return NextResponse.redirect(url);
      }
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // ── Rutas públicas del landing ──────────────────────────────────────────────
  // Si el tenant no tiene landing habilitado, redirigir al login
  const isLandingRoute =
    pathname === '/landing' ||
    pathname.startsWith('/landing/') ||
    pathname === '/programas' ||
    pathname === '/tutorias' ||
    pathname === '/planes' ||
    pathname === '/sobre-nosotras' ||
    pathname === '/contacto';

  if (isLandingRoute) {
    if (!landingHabilitado) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // ── Ruta "/login" ──────────────────────────────────────────────────────────
  if (pathname === '/login') {
    if (user) {
      // Already logged in, redirect to dashboard based on role
      const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .single();

      if (profile) {
        const redirectMap: Record<string, string> = {
          admin: '/admin',
          profesor: '/profesor',
          alumno: '/alumno',
          lector: '/lector',
        };
        const url = request.nextUrl.clone();
        url.pathname = redirectMap[profile.rol] || '/login';
        return NextResponse.redirect(url);
      }
    }
    return supabaseResponse;
  }

  // ── Rutas protegidas ───────────────────────────────────────────────────────
  const isProtected =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/profesor') ||
    pathname.startsWith('/alumno') ||
    pathname.startsWith('/lector');

  if (isProtected) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // Check role permissions only when the URL prefix doesn't match what we
    // can infer from the pathname. This avoids a profiles query on every
    // navigation for the common case where the user is on their own dashboard.
    const roleAccess: Record<string, string[]> = {
      '/admin': ['admin'],
      '/profesor': ['admin', 'profesor'],
      '/alumno': ['alumno'],
      '/lector': ['lector'],
    };

    const matchedPrefix = Object.keys(roleAccess).find((prefix) =>
      pathname.startsWith(prefix)
    );

    if (matchedPrefix) {
      // Read role from a lightweight cookie set after login to skip DB query
      const rolCookie = request.cookies.get('x-user-rol')?.value;

      if (rolCookie && roleAccess[matchedPrefix].includes(rolCookie)) {
        // Fast path: cookie matches, skip DB call
        return supabaseResponse;
      }

      // Fallback: query DB for role verification
      const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .single();

      if (!profile) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
      }

      // Set role cookie for future requests (lightweight, non-sensitive)
      supabaseResponse.cookies.set('x-user-rol', profile.rol, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60, // 1 hour — re-validated on next session refresh
        path: '/',
      });

      if (!roleAccess[matchedPrefix].includes(profile.rol)) {
        // Redirect to their own dashboard
        const redirectMap: Record<string, string> = {
          admin: '/admin',
          profesor: '/profesor',
          alumno: '/alumno',
          lector: '/lector',
        };
        const url = request.nextUrl.clone();
        url.pathname = redirectMap[profile.rol] || '/login';
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|assets|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
