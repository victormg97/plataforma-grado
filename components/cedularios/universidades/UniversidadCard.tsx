'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/common/Card';
import { cn } from '@/lib/utils';
import type { Universidad } from '@/lib/queries/cedularios/universidades';
import { useCedulariosUrl } from '../hooks/CedulariosUrlContext';
import { useCedulariosUsuario } from '../hooks/useCedulariosUsuario';
import { puedeGestionarUniversidad } from './permisosUniversidad';
import { UniversidadLogo } from './UniversidadLogo';

const CLASE_ACCION =
  'flex size-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]';

interface UniversidadCardProps {
  universidad: Universidad;
  /** Active cedularios of the universidad; `null` while the count is not available (hidden). */
  cedulariosActivos: number | null;
  onEdit: (universidad: Universidad) => void;
  onDelete: (universidad: Universidad) => void;
}

/**
 * Card of one universidad (Requirements 1.11, 1.13, 11.1): logo or placeholder, nombre, código,
 * active cedulario count, and an inactive badge for admin. Selecting it opens its cedularios
 * (`setUniversidadId`). The edit and delete buttons appear only for an admin or the profesor who
 * created the universidad.
 */
export function UniversidadCard({ universidad, cedulariosActivos, onEdit, onDelete }: UniversidadCardProps) {
  const t = useTranslations('cedularios');
  const usuario = useCedulariosUsuario();
  const { setUniversidadId } = useCedulariosUrl();

  const puedeGestionar = puedeGestionarUniversidad(usuario, universidad);
  const mostrarInactiva = usuario.isAdmin && !universidad.activo;

  return (
    <Card
      hover
      padding="sm"
      className={cn('flex items-center gap-2', !universidad.activo && 'opacity-70')}
    >
      <button
        type="button"
        onClick={() => setUniversidadId(universidad.id)}
        aria-label={t('universidades.seleccionar_aria', { nombre: universidad.nombre })}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-[var(--radius-sm)] p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]"
      >
        <UniversidadLogo url={universidad.logo_url} nombre={universidad.nombre} className="size-14" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-semibold text-[var(--color-text-primary)]">{universidad.nombre}</span>
          <span className="truncate text-sm text-[var(--color-text-muted)]">{universidad.codigo}</span>
          <span className="flex flex-wrap items-center gap-2">
            {cedulariosActivos !== null && (
              <span className="text-xs text-[var(--color-text-secondary)]">
                {t('universidades.cedularios_activos', { count: cedulariosActivos })}
              </span>
            )}
            {mostrarInactiva && (
              <span className="rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-muted)]">
                {t('universidades.inactiva')}
              </span>
            )}
          </span>
        </span>
      </button>

      {puedeGestionar && (
        <div className="flex shrink-0 items-center gap-1" role="group" aria-label={t('comun.acciones')}>
          <button
            type="button"
            onClick={() => onEdit(universidad)}
            aria-label={`${t('universidades.editar')}: ${universidad.nombre}`}
            title={t('universidades.editar')}
            className={cn(CLASE_ACCION, 'hover:text-[var(--color-text-primary)]')}
          >
            <Pencil className="size-4" aria-hidden="true" />
          </button>
          {universidad.activo && (
          <button
            type="button"
            onClick={() => onDelete(universidad)}
            aria-label={`${t('universidades.eliminar')}: ${universidad.nombre}`}
            title={t('universidades.eliminar')}
            className={cn(CLASE_ACCION, 'hover:text-[var(--color-error)]')}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
          )}
        </div>
      )}
    </Card>
  );
}
