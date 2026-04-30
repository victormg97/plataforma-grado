'use client';

import { useState } from 'react';
import { Download, ExternalLink, Play, Trash2, Link2, Video, Users, Globe, Eye, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getFileInfo, getExtension } from '@/lib/utils/fileInfo';
import { Tooltip } from '@/components/common/Tooltip';
import { RecursoPreviewModal } from '@/components/recursos/RecursoPreviewModal';
import type { UserRol } from '@/lib/supabase/types';

export interface RecursoItem {
  id: string;
  titulo: string;
  descripcion?: string | null;
  tipo: 'archivo' | 'enlace' | 'video';
  url?: string | null;
  storage_path?: string | null;
  para_todos: boolean;
  created_at: string;
  uploader_nombre: string;
  subido_por?: string;
  acceso_count?: number;
}

interface RecursoCardProps {
  recurso: RecursoItem;
  rol: UserRol;
  userId: string;
  uploaderIdMatch: boolean;
  onDelete?: (id: string) => void;
  onEdit?: (recurso: RecursoItem) => void;
  onDownload?: (recurso: RecursoItem) => Promise<void> | void;
}

const TIPO_FALLBACK = {
  enlace: { Icon: Link2, color: 'text-[var(--color-info,#2C5F8A)]', bg: 'bg-[rgba(44,95,138,0.12)]' },
  video:  { Icon: Video,  color: 'text-[var(--color-error)]',        bg: 'bg-[rgba(192,57,43,0.1)]'  },
} as const;

export function RecursoCard({
  recurso,
  rol,
  uploaderIdMatch,
  onDelete,
  onEdit,
  onDownload,
}: RecursoCardProps) {
  const t = useTranslations('recursos');
  const [showPreview, setShowPreview] = useState(false);

  // ── Icon resolution ──────────────────────────────────────────────────────
  const fileName = recurso.storage_path ?? recurso.titulo;
  const fileInfo  = recurso.tipo === 'archivo' ? getFileInfo(fileName) : null;
  const ext       = recurso.storage_path ? getExtension(recurso.storage_path) : '';

  const iconEl = fileInfo
    ? <fileInfo.Icon className={cn('h-5 w-5', fileInfo.iconColor)} />
    : (() => {
        const { Icon, color } = TIPO_FALLBACK[recurso.tipo as keyof typeof TIPO_FALLBACK] ?? TIPO_FALLBACK.enlace;
        return <Icon className={cn('h-5 w-5', color)} />;
      })();

  const iconBg = fileInfo?.iconBg
    ?? (recurso.tipo === 'video' ? 'bg-[rgba(192,57,43,0.1)]' : 'bg-[rgba(44,95,138,0.12)]');

  // ── Permissions ──────────────────────────────────────────────────────────
  const canManage = rol === 'admin' || (rol === 'profesor' && uploaderIdMatch);
  const canPreview = recurso.tipo !== 'archivo' || (fileInfo?.canPreview ?? false);

  const handlePrimaryAction = () => {
    if (recurso.tipo === 'archivo') {
      if (canPreview) setShowPreview(true);
      else onDownload?.(recurso);
    } else if (recurso.url) {
      window.open(recurso.url, '_blank', 'noopener,noreferrer');
    }
  };

  // Action button base class:
  // mobile  → always visible
  // desktop → hidden until card hover (lg:opacity-0 / lg:group-hover:opacity-100)
  const actionBtnCls = cn(
    'flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)]',
    'text-[var(--color-text-muted)] transition-colors',
    'lg:opacity-0 lg:group-hover:opacity-100 lg:transition-opacity',
  );

  return (
    <>
      <div
        role="article"
        className="group relative flex h-full gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 shadow-[var(--shadow-sm)] transition-all hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-md)]"
      >
        {/* File icon — clickable for primary action */}
        <button
          type="button"
          onClick={handlePrimaryAction}
          aria-label={t(canPreview ? 'ver' : 'descargar')}
          className={cn(
            'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] transition-opacity hover:opacity-75',
            iconBg,
          )}
        >
          {iconEl}
        </button>

        {/* Content */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="truncate text-sm font-semibold text-[var(--color-text-primary)] hover:underline text-left"
            >
              {recurso.titulo}
            </button>
            {recurso.tipo === 'archivo' && fileInfo && ext && (
              <span className={cn(
                'flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                fileInfo.badgeColor,
              )}>
                {ext}
              </span>
            )}
          </div>

          {recurso.descripcion && (
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)] line-clamp-1">
              {recurso.descripcion}
            </p>
          )}

          <div className="mt-auto pt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            {(rol === 'admin' || rol === 'profesor') && (
              <span className="text-xs text-[var(--color-text-muted)]">
                {t('subido_por', { nombre: recurso.uploader_nombre })}
              </span>
            )}
            <span className="text-xs text-[var(--color-text-muted)]">
              {format(new Date(recurso.created_at), 'd MMM yyyy', { locale: es })}
            </span>
            {(rol === 'admin' || rol === 'profesor') && (
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                recurso.para_todos
                  ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]',
              )}>
                {recurso.para_todos
                  ? <><Globe className="h-2.5 w-2.5" />{t('para_todos')}</>
                  : <><Users className="h-2.5 w-2.5" />{t('solo_asignados', { count: recurso.acceso_count ?? 0 })}</>}
              </span>
            )}
          </div>
        </div>

        {/* ── Action buttons ───────────────────────────────────────────────────
             Mobile: always visible. Desktop: fade in on group-hover via lg: classes.
        */}
        <div className="flex flex-shrink-0 items-start gap-0.5 pt-0.5">
          {/* View / Open */}
          <Tooltip
            content={canPreview
              ? t('ver')
              : t(recurso.tipo === 'archivo' ? 'descargar' : 'abrir')}
            position="top"
          >
            <button
              type="button"
              onClick={handlePrimaryAction}
              aria-label={t(canPreview ? 'ver' : 'descargar')}
              className={cn(actionBtnCls, 'hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]')}
            >
              {recurso.tipo === 'archivo'
                ? canPreview ? <Eye className="h-4 w-4" /> : <Download className="h-4 w-4" />
                : recurso.tipo === 'video' ? <Play className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
            </button>
          </Tooltip>

          {/* Download (secondary, only for previewable files) */}
          {recurso.tipo === 'archivo' && canPreview && onDownload && (
            <Tooltip content={t('descargar')} position="top">
              <button
                type="button"
                onClick={() => onDownload(recurso)}
                aria-label={t('descargar')}
                className={cn(actionBtnCls, 'hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]')}
              >
                <Download className="h-4 w-4" />
              </button>
            </Tooltip>
          )}

          {/* Edit */}
          {canManage && onEdit && (
            <Tooltip content={t('editar')} position="top">
              <button
                type="button"
                onClick={() => onEdit(recurso)}
                aria-label={t('editar')}
                className={cn(actionBtnCls, 'hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]')}
              >
                <Pencil className="h-4 w-4" />
              </button>
            </Tooltip>
          )}

          {/* Delete */}
          {canManage && onDelete && (
            <Tooltip content={t('eliminar')} position="top">
              <button
                type="button"
                onClick={() => onDelete(recurso.id)}
                aria-label={t('eliminar')}
                className={cn(actionBtnCls, 'hover:bg-[rgba(192,57,43,0.1)] hover:text-[var(--color-error)]')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {showPreview && (
        <RecursoPreviewModal
          recurso={recurso}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
}
