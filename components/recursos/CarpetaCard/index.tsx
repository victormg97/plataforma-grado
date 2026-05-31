'use client';

import { Folder, Pencil, Trash2, Globe, Users, Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { CardActions, type CardAction } from '@/components/common/CardActions';

export interface CarpetaItem {
  id: string;
  nombre: string;
  parent_id: string | null;
  creada_por: string;
  created_at: string;
  updated_at: string;
  creador_nombre?: string;
  /** Count of resources directly inside (computed client-side, kept for compat) */
  recursos_count?: number;
  /** Recursive count of ALL resources inside this folder and all subfolders (from RPC) */
  recursive_recursos_count?: number;
  /** True if ANY resource in the full tree has para_todos=true (from RPC) */
  para_todos_efectivo?: boolean;
  /** True if ANY resource in the full tree has para_todos_app=true (from RPC) */
  para_todos_app_efectivo?: boolean;
  /** Union of all alumno_ids from recursos_acceso for resources in the full tree (from RPC) */
  alumno_ids_efectivos?: string[];
}

interface CarpetaCardProps {
  carpeta: CarpetaItem;
  canManage: boolean;
  /** When false, hides the visibility badge (e.g. for alumno role) */
  showPermisoBadge?: boolean;
  onClick: () => void;
  onRename: (carpeta: CarpetaItem) => void;
  onDelete: (carpeta: CarpetaItem) => void;
  onEditPermisos: (carpeta: CarpetaItem) => void;
}

export function CarpetaCard({ carpeta, canManage, showPermisoBadge = true, onClick, onRename, onDelete, onEditPermisos }: CarpetaCardProps) {
  const t = useTranslations('recursos');

  // Use recursive count (all subfolders) if available, fall back to direct count
  const displayCount = carpeta.recursive_recursos_count ?? carpeta.recursos_count ?? 0;
  const tieneRecursos = displayCount > 0;
  const paraTodosApp = carpeta.para_todos_app_efectivo ?? false;
  const paraTodos = carpeta.para_todos_efectivo ?? false;
  const alumnosCount = carpeta.alumno_ids_efectivos?.length ?? 0;

  // Build actions for the ellipsis menu (consistent UX across all views)
  const actions: CardAction[] = [
    {
      key: 'permisos',
      label: t('editar_permisos_carpeta'),
      icon: <Settings2 className="size-4" />,
      onClick: () => onEditPermisos(carpeta),
    },
    {
      key: 'renombrar',
      label: t('renombrar_carpeta'),
      icon: <Pencil className="size-4" />,
      onClick: () => onRename(carpeta),
    },
    {
      key: 'eliminar',
      label: t('eliminar_carpeta'),
      icon: <Trash2 className="size-4" />,
      onClick: () => onDelete(carpeta),
      danger: true,
    },
  ];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="group relative flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 shadow-[var(--shadow-sm)] transition-all hover:border-[var(--color-brand-gold)]/50 hover:shadow-[var(--shadow-md)] cursor-pointer"
    >
      {/* Folder icon */}
      <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand-gold-muted)]">
        <Folder className="size-5 text-[var(--color-brand-gold)]" />
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{carpeta.nombre}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {carpeta.recursos_count !== undefined && (
            <span className="text-xs text-[var(--color-text-muted)]">
              {t('carpeta_recursos_count', { count: displayCount })}
            </span>
          )}
          {/* Visibility badge — only shown when there are resources AND showPermisoBadge is true */}
          {tieneRecursos && showPermisoBadge && (
            <span className={cn(
              'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
              paraTodosApp
                ? 'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]'
                : paraTodos
                  ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                  : alumnosCount > 0
                    ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]'
                    : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]',
            )}>
              {paraTodosApp
                ? <><Globe className="size-2.5" />{t('todos_app')}</>
                : paraTodos
                  ? <><Globe className="size-2.5" />{t('para_todos')}</>
                  : alumnosCount > 0
                    ? <><Users className="size-2.5" />{t('solo_asignados', { count: alumnosCount })}</>
                    : <><Users className="size-2.5" />{t('carpeta_sin_permisos')}</>}
            </span>
          )}
        </div>
      </div>

      {/* Actions — only for managers. Always shows the ellipsis menu (consistent UX). */}
      {canManage && (
        <div
          className="flex shrink-0 items-center"
          onClick={(e) => e.stopPropagation()}
        >
          <CardActions actions={actions} mobileOnly />
        </div>
      )}
    </div>
  );
}
