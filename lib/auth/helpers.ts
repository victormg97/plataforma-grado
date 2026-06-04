import type { UserRol } from '@/lib/supabase/types';

export function getRolRedirectPath(rol: UserRol): string {
  switch (rol) {
    case 'admin':
      return '/admin';
    case 'profesor':
      return '/profesor';
    case 'alumno':
      return '/alumno';
    case 'lector':
      return '/lector';
    default:
      return '/login';
  }
}

export function isProtectedRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/profesor') ||
    pathname.startsWith('/alumno') ||
    pathname.startsWith('/lector')
  );
}

export function getRequiredRoles(pathname: string): UserRol[] {
  if (pathname.startsWith('/admin')) return ['admin'];
  if (pathname.startsWith('/profesor')) return ['admin', 'profesor'];
  if (pathname.startsWith('/alumno')) return ['alumno'];
  if (pathname.startsWith('/lector')) return ['lector'];
  return [];
}
