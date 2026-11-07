'use client';

import { ArrowRight, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/common/Card';
import { cn } from '@/lib/utils';
import type { Universidad } from '@/lib/queries/cedularios/universidades';
import { useCedulariosUrl } from '../hooks/CedulariosUrlContext';
import { useCedulariosUsuario } from '../hooks/useCedulariosUsuario';
import { puedeGestionarUniversidad } from './permisosUniversidad';
import { UniversidadLogo } from './UniversidadLogo';

const CLASE_ACCION =
  'flex size-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-muted)] shadow-sm transition-colors hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]';

interface UniversidadCardProps {
  universidad: Universidad;
  /** Active cedularios of the universidad; `null` while the count is not available (hidden). */
  cedulariosActivos: number | null;
  onEdit: (universidad: Universidad) => void;
  onDelete: (universidad: Universidad) => void;
}

/**
 * Vertical card of one universidad (Requirements 1.11, 1.13, 11.1): centered logo or placeholder,
 * nombre, código, active cedulario count, and an inactive badge for admin. Selecting it opens its
 * cedularios (`setUniversidadId`). The edit and delete buttons float in the top-right corner and
 * appear only for an admin or the profesor who created the universidad.
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
      padding="none"
      className={cn('group relative h-full overflow-hidden', !universidad.activo && 'opacity-70')}
    >
      <button
        type="button"
        onClick={() => setUniversidadId(universidad.id)}
        aria-label={t('universidades.seleccionar_aria', { nombre: universidad.nombre })}
        className="flex h-full w-full flex-col items-center text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-brand-gold)]"
      >
        {/* Hero: soft tinted backdrop with a glow, so transparent PNG logos float on it. */}
        <span className="relative flex h-44 w-full items-center justify-center overflow-hidden bg-gradient-to-b from-[var(--color-bg-secondary)] to-transparent">
          <span
            aria-hidden="true"
            className="absolute size-36 rounded-full bg-[var(--color-bg)] opacity-70 blur-2xl transition-opacity group-hover:opacity-100"
          />
          <UniversidadLogo
            url={universidad.logo_url}
            nombre={universidad.nombre}
            className="relative size-32 rounded-2xl border-0 bg-transparent drop-shadow-[0_6px_10px_rgba(0,0,0,0.15)] transition-transform duration-300 group-hover:scale-105"
          />
        </span>

        <span className="flex w-full min-w-0 flex-1 flex-col items-center gap-2 px-4 pt-1">
          <span className="line-clamp-2 min-h-[2.75rem] text-base font-semibold leading-snug text-[var(--color-text-primary)]">
            {universidad.nombre}
          </span>
          <span className="flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-0.5 text-xs font-semibold tracking-wide text-[var(--color-text-secondary)]">
              {universidad.codigo}
            </span>
            {mostrarInactiva && (
              <span className="rounded-full border border-[var(--color-border)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-text-muted)]">
                {t('universidades.inactiva')}
              </span>
            )}
          </span>
        </span>

        <span className="mx-4 mb-4 mt-3 flex w-[calc(100%-2rem)] items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3 text-sm">
          <span className="text-[var(--color-text-secondary)]">
            {cedulariosActivos !== null ? t('universidades.cedularios_activos', { count: cedulariosActivos }) : ''}
          </span>
          <span className="flex items-center gap-1 font-medium text-[var(--color-brand-gold)]">
            {t('universidades.ver_cedularios')}
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </span>
      </button>

      {puedeGestionar && (
        <div
          className="absolute right-2 top-2 z-10 flex items-center gap-1.5"
          role="group"
          aria-label={t('comun.acciones')}
        >
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
