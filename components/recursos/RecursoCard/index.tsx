'use client';

import { useState } from 'react';
import { Link2, Video, Users, Globe, FolderInput } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getFileInfo, getExtension } from '@/lib/utils/fileInfo';
import { RecursoPreviewModal } from '@/components/recursos/RecursoPreviewModal';
import { ExternalLinkModal } from '@/components/common/ExternalLinkModal';
import {
  CardActions as RecursoCardActions,
  Eye,
  Download,
  ExternalLink,
  Play,
  Pencil,
  Trash2,
  type CardAction as RecursoCardAction,
} from '@/components/common/CardActions';
import type { UserRol } from '@/lib/supabase/types';

export interface RecursoItem {
  id: string;
  titulo: string;
  descripcion?: string | null;
  tipo: 'archivo' | 'enlace' | 'video';
  url?: string | null;
  storage_path?: string | null;
  para_todos: boolean;
  para_todos_app?: boolean;
  bloquear_descarga?: boolean;
  carpeta_id?: string | null;
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
  onMove?: (recurso: RecursoItem) => void;
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
  onMove,
}: RecursoCardProps) {
  const t = useTranslations('recursos');
  const [showPreview, setShowPreview] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);

  // ── Icon resolution ──────────────────────────────────────────────────────
  const fileName = recurso.storage_path ?? recurso.titulo;
  const fileInfo  = recurso.tipo === 'archivo' ? getFileInfo(fileName) : null;
  const ext       = recurso.storage_path ? getExtension(recurso.storage_path) : '';

  const iconEl = fileInfo
    ? <fileInfo.Icon className={cn('size-5', fileInfo.iconColor)} />
    : (() => {
        const { Icon, color } = TIPO_FALLBACK[recurso.tipo as keyof typeof TIPO_FALLBACK] ?? TIPO_FALLBACK.enlace;
        return <Icon className={cn('size-5', color)} />;
      })();

  const iconBg = fileInfo?.iconBg
    ?? (recurso.tipo === 'video' ? 'bg-[rgba(192,57,43,0.1)]' : 'bg-[rgba(44,95,138,0.12)]');

  // ── Permissions ──────────────────────────────────────────────────────────
  const canManage = rol === 'admin' || (rol === 'profesor' && uploaderIdMatch);
  const canPreview = recurso.tipo !== 'archivo' || (fileInfo?.canPreview ?? false);
  const canDownload = rol !== 'alumno' || !recurso.bloquear_descarga;

  // ── Primary action (tap anywhere on card) ────────────────────────────────
  const handlePrimaryAction = () => {
    if (recurso.tipo === 'archivo') {
      if (canPreview) setShowPreview(true);
      else if (canDownload) onDownload?.(recurso);
    } else if (recurso.tipo === 'video') {
      setShowPreview(true);
    } else if (recurso.tipo === 'enlace') {
      // Always intercept external links with the confirmation modal
      setShowLinkModal(true);
    }
  };

  // ── Build actions list ────────────────────────────────────────────────────
  const actions: RecursoCardAction[] = [];

  // View / open
  if (canPreview || recurso.tipo === 'video') {
    actions.push({
      key: 'ver',
      label: t('ver'),
      icon: recurso.tipo === 'video' ? <Play className="size-4" /> : <Eye className="size-4" />,
      onClick: handlePrimaryAction,
    });
  } else if (recurso.tipo === 'enlace') {
    actions.push({
      key: 'abrir',
      label: t('abrir'),
      icon: <ExternalLink className="size-4" />,
      onClick: () => setShowLinkModal(true),
    });
  } else if (canDownload) {
    actions.push({
      key: 'descargar-primary',
      label: t('descargar'),
      icon: <Download className="size-4" />,
      onClick: handlePrimaryAction,
    });
  }

  // Download (secondary, only when file is previewable and download allowed)
  if (recurso.tipo === 'archivo' && canPreview && canDownload && onDownload) {
    actions.push({
      key: 'descargar',
      label: t('descargar'),
      icon: <Download className="size-4" />,
      onClick: () => onDownload(recurso),
    });
  }

  // Move to folder
  if (canManage && onMove) {
    actions.push({
      key: 'mover',
      label: t('mover_a_carpeta'),
      icon: <FolderInput className="size-4" />,
      onClick: () => onMove(recurso),
    });
  }

  // Edit
  if (canManage && onEdit) {
    actions.push({
      key: 'editar',
      label: t('editar'),
      icon: <Pencil className="size-4" />,
      onClick: () => onEdit(recurso),
    });
  }

  // Delete
  if (canManage && onDelete) {
    actions.push({
      key: 'eliminar',
      label: t('eliminar'),
      icon: <Trash2 className="size-4" />,
      onClick: () => onDelete(recurso.id),
      danger: true,
    });
  }

  return (
    <>
      {/* Card — entire surface is clickable for primary action */}
      <div
        role="article"
        onClick={handlePrimaryAction}
        className="group relative flex h-full cursor-pointer gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 shadow-[var(--shadow-sm)] transition-all hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-md)] overflow-hidden"
      >
        {/* File icon */}
        <div
          className={cn(
            'flex size-10 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)]',
            iconBg,
          )}
        >
          {iconEl}
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
              {recurso.titulo}
            </span>
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
                recurso.para_todos_app
                  ? 'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]'
                  : recurso.para_todos
                  ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                  : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)]',
              )}>
                {recurso.para_todos_app
                  ? <><Globe className="size-2.5" />{t('todos_app')}</>
                  : recurso.para_todos
                  ? <><Globe className="size-2.5" />{t('para_todos')}</>
                  : <><Users className="size-2.5" />{t('solo_asignados', { count: recurso.acceso_count ?? 0 })}</>}
              </span>
            )}
          </div>
        </div>

        {/* Actions — stops propagation internally so clicks don't trigger card */}
        <div onClick={(e) => e.stopPropagation()}>
          <RecursoCardActions actions={actions} mobileOnly />
        </div>
      </div>

      {showPreview && (
        <RecursoPreviewModal
          recurso={recurso}
          canDownload={canDownload}
          onClose={() => setShowPreview(false)}
        />
      )}

      {showLinkModal && recurso.url && (
        <ExternalLinkModal
          url={recurso.url}
          title={recurso.titulo}
          onConfirm={() => {
            window.open(recurso.url!, '_blank', 'noopener,noreferrer');
            setShowLinkModal(false);
          }}
          onCancel={() => setShowLinkModal(false)}
        />
      )}
    </>
  );
}
