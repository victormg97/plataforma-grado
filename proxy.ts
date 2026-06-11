import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { checkApiRateLimit, getIp, tooManyRequestsResponse } from '@/lib/utils/rateLimit';
import { tenantConfig } from '@/config';

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

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

    // Check role permissions
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

    const roleAccess: Record<string, string[]> = {
      '/admin': ['admin'],
      '/profesor': ['admin', 'profesor'],
      '/alumno': ['alumno'],
      '/lector': ['lector'],
    };

    const matchedPrefix = Object.keys(roleAccess).find((prefix) =>
      pathname.startsWith(prefix)
    );

    if (matchedPrefix && !roleAccess[matchedPrefix].includes(profile.rol)) {
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

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|assets|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
