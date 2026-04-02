'use client';

import { BookOpen, ClipboardList, Globe, Pencil, RotateCcw, Trash2, User, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Card } from '@/components/common/Card';
import { Tooltip } from '@/components/common/Tooltip';
import type { ProgramaClaseConConteo } from '@/lib/supabase/types';

interface ProgramaCardProps {
  programa: ProgramaClaseConConteo;
  canEdit?: boolean;
  /** Solo admin puede ver el badge de visibilidad */
  showVisibilidad?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onHardDelete?: () => void;
}

export function ProgramaCard({
  programa,
  canEdit = false,
  showVisibilidad = false,
  onClick,
  onEdit,
  onDelete,
  onRestore,
  onHardDelete,
}: ProgramaCardProps) {
  const t = useTranslations('programas');
  const isDeleted = programa.estado === 'eliminado';

  // Derive visibility info
  const visibilidad = programa.visibilidad ?? 'todos';
  const profesoresAsignados = programa.profesores_asignados ?? [];
  // If especifico but junction is empty, fall back to creator info
  const creadoPor = programa.creado_por ?? null;
  const displayProfesores =
    profesoresAsignados.length > 0
      ? profesoresAsignados
      : creadoPor
      ? [{ id: creadoPor.id, nombre: creadoPor.nombre, apellido: creadoPor.apellido, avatar_url: null }]
      : [];

  const renderVisibilidadBadge = () => {
    if (!showVisibilidad || isDeleted) return null;

    if (visibilidad === 'todos') {
      return (
        <span className="flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]">
          <Globe className="h-2.5 w-2.5" />
          {t('badge_global')}
        </span>
      );
    }

    if (displayProfesores.length === 1) {
      return (
        <span className="flex items-center gap-1 rounded-full bg-[var(--color-brand-gold-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-primary)]">
          <User className="h-2.5 w-2.5" />
          {displayProfesores[0].nombre} {displayProfesores[0].apellido}
        </span>
      );
    }

    if (displayProfesores.length > 1) {
      // Multiple professors — use tooltip on hover
      const names = displayProfesores.map((p) => `${p.nombre} ${p.apellido}`).join('\n');
      return (
        <Tooltip content={names} position="top" variant="subtle">
          <span className="flex cursor-default items-center gap-1 rounded-full bg-[var(--color-brand-gold-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-primary)]">
            <Users className="h-2.5 w-2.5" />
            {t('badge_n_profes', { count: displayProfesores.length })}
          </span>
        </Tooltip>
      );
    }

    // visibilidad=especifico but no data at all — show generic
    return (
      <span className="flex items-center gap-1 rounded-full bg-[var(--color-bg-secondary)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]">
        <User className="h-2.5 w-2.5" />
        {t('form.vis_especifico')}
      </span>
    );
  };

  return (
    <Card
      hover={!!onClick}
      onClick={onClick}
      className={cn(
        'flex flex-col gap-3',
        isDeleted && 'opacity-60'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-gold-muted)]">
            {isDeleted ? (
              <ClipboardList className="h-5 w-5 text-[var(--color-text-muted)]" />
            ) : (
              <BookOpen className="h-5 w-5 text-[var(--color-brand-gold)]" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[var(--color-text-primary)] truncate">{programa.nombre}</p>
            {programa.descripcion && (
              <p className="text-sm text-[var(--color-text-muted)] line-clamp-2">{programa.descripcion}</p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        {canEdit && (
          <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {isDeleted ? (
              <>
                {onRestore && (
                  <Tooltip content={t('restaurar_tooltip')} position="top">
                    <button
                      type="button"
                      onClick={onRestore}
                      className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-brand-gold)] transition-colors"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  </Tooltip>
                )}
                {onHardDelete && (
                  <Tooltip content={t('eliminar_definitivo_tooltip')} position="top">
                    <button
                      type="button"
                      onClick={onHardDelete}
                      className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-red-50 hover:text-[var(--color-error)] dark:hover:bg-red-950/20 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </Tooltip>
                )}
              </>
            ) : (
              <>
                {onEdit && (
                  <Tooltip content={t('editar_tooltip')} position="top">
                    <button
                      type="button"
                      onClick={onEdit}
                      className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </Tooltip>
                )}
                {onDelete && (
                  <Tooltip content={t('eliminar_tooltip')} position="top">
                    <button
                      type="button"
                      onClick={onDelete}
                      className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-red-50 hover:text-[var(--color-error)] dark:hover:bg-red-950/20 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </Tooltip>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Stats row + visibility badge */}
      <div className="flex items-center gap-4 text-sm text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5" />
          {t('n_clases', { count: programa.total_clases ?? 0 })}
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {t('n_asignados', { count: programa.total_asignados ?? 0 })}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          {isDeleted ? (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-[var(--color-error)] dark:bg-red-950/20">
              {t('estado.eliminado')}
            </span>
          ) : (
            renderVisibilidadBadge()
          )}
        </span>
      </div>
    </Card>
  );
}
