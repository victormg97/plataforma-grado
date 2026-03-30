import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
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

  const pathname = request.nextUrl.pathname;

  // Public routes
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
        };
        const url = request.nextUrl.clone();
        url.pathname = redirectMap[profile.rol] || '/login';
        return NextResponse.redirect(url);
      }
    }
    return supabaseResponse;
  }

  // Protected routes
  const isProtected =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/profesor') ||
    pathname.startsWith('/alumno');

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
      };
      const url = request.nextUrl.clone();
      url.pathname = redirectMap[profile.rol] || '/login';
      return NextResponse.redirect(url);
    }
  }

  // Root redirect
  if (pathname === '/') {
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

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|assets|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
