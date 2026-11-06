'use client';

import { useMemo } from 'react';
import { useUser } from '@/lib/hooks/useUser';
import type { UserRol } from '@/lib/supabase/types';

export interface CedulariosUsuario {
  userId: string | null;
  rol: UserRol | null;
  isAdmin: boolean;
  isProfesor: boolean;
  /** admin or profesor. */
  isStaff: boolean;
  /** alumno or lector: read-only access to the module. */
  isReadOnlyRole: boolean;
}

/** Adapter over the existing `useUser` hook; it adds no auth mechanism. */
export function useCedulariosUsuario(): CedulariosUsuario {
  const { user } = useUser();
  const userId = user?.id ?? null;
  const rol = (user?.rol ?? null) as UserRol | null;

  return useMemo(() => {
    const isAdmin = rol === 'admin';
    const isProfesor = rol === 'profesor';
    return {
      userId,
      rol,
      isAdmin,
      isProfesor,
      isStaff: isAdmin || isProfesor,
      isReadOnlyRole: rol === 'alumno' || rol === 'lector',
    };
  }, [userId, rol]);
}
