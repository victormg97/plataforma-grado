'use client';

import { useMemo } from 'react';
import { useCedulariosUsuario } from '@/components/cedularios/hooks/useCedulariosUsuario';
import type { UserRol } from '@/lib/supabase/types';

export interface SegRol {
  rol: UserRol | null;
  userId: string | null;
  isAdmin: boolean;
  isProfesor: boolean;
  /** admin or profesor: can open the reviewer and manage assignments. */
  isStaff: boolean;
  isAlumno: boolean;
  isLector: boolean;
}

/** Role and user id for the tracking feature; adapter over `useCedulariosUsuario`. */
export function useSegRol(): SegRol {
  const { rol, userId, isAdmin, isProfesor, isStaff } = useCedulariosUsuario();

  return useMemo(
    () => ({
      rol,
      userId,
      isAdmin,
      isProfesor,
      isStaff,
      isAlumno: rol === 'alumno',
      isLector: rol === 'lector',
    }),
    [rol, userId, isAdmin, isProfesor, isStaff],
  );
}
