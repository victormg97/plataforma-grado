'use client';

import { useTenant } from '@/config/client';

/**
 * Returns the tenant-configured term for "prueba" (exam-type class).
 * CTA Graduados → { singular: 'Prueba', plural: 'Pruebas' }
 * Pregunta Estratégica → { singular: 'Interrogación', plural: 'Interrogaciones' }
 */
export function usePruebaTerm() {
  const tenant = useTenant();
  return tenant.terminoPrueba;
}
