'use client';

/** Small role badge for assignees that are not alumnos. Renders nothing for alumnos. */

import { useTranslations } from 'next-intl';
import type { AsignatarioRol } from '@/lib/cedularios/seguimiento/asignatario';

export function RolAsignatarioBadge({ rol }: { rol: AsignatarioRol }) {
  const t = useTranslations('cedularios.seguimiento.comun');
  if (rol === 'alumno') return null;
  return (
    <span className="shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-brand-gold-muted)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-primary)]">
      {rol === 'admin' ? t('rol_admin') : t('rol_profesor')}
    </span>
  );
}
