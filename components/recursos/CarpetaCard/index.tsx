'use client';

import { useState } from 'react';
import { Folder, Pencil, Trash2, MoreHorizontal, Globe, Users, Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/common/Tooltip';

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
  /** True if ANY resource inside has para_todos=true (from RPC) */
  para_todos_efectivo?: boolean;
  /** Union of all alumno_ids from recursos_acceso for resources in this folder (from RPC) */
  alumno_ids_efectivos?: string[];
}

interface CarpetaCardProps {
  carpeta: CarpetaItem;
  canManage: boolean;
  onClick: () => void;
  onRename: (carpeta: CarpetaItem) => void;
  onDelete: (carpeta: CarpetaItem) => void;
  onEditPermisos: (carpeta: CarpetaItem) => void;
}

export function CarpetaCard({ carpeta, canManage, onClick, onRename, onDelete, onEditPermisos }: CarpetaCardProps) {
  const t = useTranslations('recursos');
  const [menuOpen, setMenuOpen] = useState(false);

  // Use recursive count (all subfolders) if available, fall back to direct count
  const displayCount = carpeta.recursive_recursos_count ?? carpeta.recursos_count ?? 0;
  const tieneRecursos = displayCount > 0;
  const paraTodos = carpeta.para_todos_efectivo ?? false;
  const alumnosCount = carpeta.alumno_ids_efectivos?.length ?? 0;

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
          {/* Visibility badge — only shown when there are resources */}
          {tieneRecursos && (
            <span className={cn(
              'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
              paraTodos
                ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                : alumnosCount > 0
                  ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]',
            )}>
              {paraTodos
                ? <><Globe className="size-2.5" />{t('para_todos')}</>
                : alumnosCount > 0
                  ? <><Users className="size-2.5" />{t('solo_asignados', { count: alumnosCount })}</>
                  : <><Users className="size-2.5" />{t('carpeta_sin_permisos')}</>}
            </span>
          )}
        </div>
      </div>

      {/* Actions — only for managers */}
      {canManage && (
        <div
          className="relative flex shrink-0 items-center"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Desktop: icon buttons on hover */}
          <div className="hidden lg:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip content={t('editar_permisos_carpeta')} position="top">
              <button
                type="button"
                onClick={() => onEditPermisos(carpeta)}
                className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <Settings2 className="size-3.5" />
              </button>
            </Tooltip>
            <Tooltip content={t('renombrar_carpeta')} position="top">
              <button
                type="button"
                onClick={() => onRename(carpeta)}
                className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <Pencil className="size-3.5" />
              </button>
            </Tooltip>
            <Tooltip content={t('eliminar_carpeta')} position="top">
              <button
                type="button"
                onClick={() => onDelete(carpeta)}
                className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-red-50 hover:text-[var(--color-error)] transition-colors"
              >
                <Trash2 className="size-3.5" />
              </button>
            </Tooltip>
          </div>

          {/* Mobile: ⋯ menu */}
          <div className="flex lg:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className={cn(
                'flex size-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors',
                'hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]',
                menuOpen && 'bg-[var(--color-bg-secondary)]',
              )}
            >
              <MoreHorizontal className="size-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] py-1 shadow-[var(--shadow-lg)]">
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onEditPermisos(carpeta); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
                >
                  <Settings2 className="size-4" />
                  {t('editar_permisos_carpeta')}
                </button>
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onRename(carpeta); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
                >
                  <Pencil className="size-4" />
                  {t('renombrar_carpeta')}
                </button>
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onDelete(carpeta); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-error)] hover:bg-red-50/50"
                >
                  <Trash2 className="size-4" />
                  {t('eliminar_carpeta')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
