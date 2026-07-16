'use client';

import { useState, useMemo, useCallback } from 'react';
import { Folder, FolderOpen, ChevronRight, ArrowLeft, Home, FolderInput } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { cn } from '@/lib/utils';
import type { CarpetaItem } from '@/components/recursos/CarpetaCard';
import type { RecursoItem } from '@/components/recursos/RecursoCard';

interface MoverRecursoModalProps {
  /** Resource being moved (when moving a file) */
  recurso?: RecursoItem | null;
  /** Folder being moved (when moving a folder) */
  carpeta?: CarpetaItem | null;
  /** All available folders for the user */
  carpetas: CarpetaItem[];
  onClose: () => void;
  onMove: (carpetaId: string | null) => Promise<void>;
  moving: boolean;
}

export function MoverRecursoModal({ recurso, carpeta, carpetas, onClose, onMove, moving }: MoverRecursoModalProps) {
  const t = useTranslations('recursos');

  // Current location in the folder picker
  const [browseCarpetaId, setBrowseCarpetaId] = useState<string | null>(null);

  // Determine the item being moved and its current location
  const isMovingFolder = !!carpeta;
  const itemName = carpeta?.nombre ?? recurso?.titulo ?? '';
  const currentParentId = carpeta?.parent_id ?? recurso?.carpeta_id ?? null;

  // When moving a folder, we must exclude it and all its descendants
  const excludedFolderIds = useMemo(() => {
    if (!carpeta) return new Set<string>();
    const excluded = new Set<string>();
    const collectDescendants = (parentId: string) => {
      excluded.add(parentId);
      carpetas
        .filter((c) => c.parent_id === parentId)
        .forEach((c) => collectDescendants(c.id));
    };
    collectDescendants(carpeta.id);
    return excluded;
  }, [carpeta, carpetas]);

  // Get subfolders at the current browse level, excluding forbidden ones
  const currentSubfolders = useMemo(() => {
    return carpetas
      .filter((c) => c.parent_id === browseCarpetaId && !excludedFolderIds.has(c.id))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [carpetas, browseCarpetaId, excludedFolderIds]);

  // Build breadcrumb path for current browse location
  const breadcrumb = useMemo(() => {
    if (!browseCarpetaId) return [];
    const path: CarpetaItem[] = [];
    let id: string | null = browseCarpetaId;
    while (id) {
      const c = carpetas.find((x) => x.id === id);
      if (!c) break;
      path.unshift(c);
      id = c.parent_id;
    }
    return path;
  }, [browseCarpetaId, carpetas]);

  // Parent of the current browse location (for back navigation)
  const browseParentId = useMemo(() => {
    if (!browseCarpetaId) return null;
    const current = carpetas.find((c) => c.id === browseCarpetaId);
    return current?.parent_id ?? null;
  }, [browseCarpetaId, carpetas]);

  // Whether the "move here" button should be disabled (already in this location)
  const isSameLocation = browseCarpetaId === currentParentId;

  const handleMoveHere = useCallback(() => {
    if (isSameLocation || moving) return;
    onMove(browseCarpetaId);
  }, [browseCarpetaId, isSameLocation, moving, onMove]);

  const title = isMovingFolder ? t('mover_carpeta') : t('mover_recurso');

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={itemName}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="ghost" onClick={onClose} disabled={moving} size="sm">
            {t('cancelar')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleMoveHere}
            disabled={isSameLocation || moving}
            loading={moving}
            icon={<FolderInput className="size-4" />}
          >
            {t('mover_aqui')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Breadcrumb / navigation header */}
        <div className="flex items-center gap-1.5 min-h-[32px]">
          {browseCarpetaId && (
            <button
              type="button"
              onClick={() => setBrowseCarpetaId(browseParentId)}
              className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
              aria-label={t('volver_carpeta')}
            >
              <ArrowLeft className="size-4" />
            </button>
          )}
          <nav className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs">
            <button
              type="button"
              onClick={() => setBrowseCarpetaId(null)}
              className={cn(
                'flex items-center gap-1 transition-colors',
                !browseCarpetaId
                  ? 'font-semibold text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
              )}
            >
              <Home className="size-3" />
              {t('raiz')}
            </button>
            {breadcrumb.map((c) => (
              <span key={c.id} className="flex items-center gap-1">
                <ChevronRight className="size-3 text-[var(--color-text-muted)]" />
                <button
                  type="button"
                  onClick={() => setBrowseCarpetaId(c.id)}
                  className={cn(
                    'truncate max-w-[120px] transition-colors',
                    c.id === browseCarpetaId
                      ? 'font-semibold text-[var(--color-text-primary)]'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
                  )}
                >
                  {c.nombre}
                </button>
              </span>
            ))}
          </nav>
        </div>

        {/* Current location indicator */}
        {isSameLocation && (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-brand-gold)]/30 bg-[var(--color-brand-gold-muted)] px-3 py-2 text-xs text-[var(--color-brand-gold)]">
            {t('ubicacion_actual_aqui')}
          </div>
        )}

        {/* Folder list */}
        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {currentSubfolders.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <FolderOpen className="size-8 text-[var(--color-text-muted)]" />
              <p className="text-sm text-[var(--color-text-muted)]">
                {t('sin_subcarpetas')}
              </p>
            </div>
          ) : (
            currentSubfolders.map((c) => {
              const hasChildren = carpetas.some(
                (sub) => sub.parent_id === c.id && !excludedFolderIds.has(sub.id)
              );
              const isCurrent = c.id === currentParentId;

              return (
                <div
                  key={c.id}
                  className={cn(
                    'flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2.5 transition-colors',
                    isCurrent
                      ? 'border-[var(--color-brand-gold)]/50 bg-[var(--color-brand-gold-muted)]'
                      : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-secondary)]',
                  )}
                >
                  {/* Folder icon */}
                  <Folder className="size-4 shrink-0 text-[var(--color-brand-gold)]" />

                  {/* Folder name — clicking enters the folder */}
                  <button
                    type="button"
                    onClick={() => setBrowseCarpetaId(c.id)}
                    className="flex-1 truncate text-left text-sm font-medium text-[var(--color-text-primary)]"
                  >
                    {c.nombre}
                  </button>

                  {isCurrent && (
                    <span className="shrink-0 text-[10px] font-medium text-[var(--color-brand-gold)]">
                      {t('ubicacion_actual')}
                    </span>
                  )}

                  {/* Enter subfolder arrow (only if has children) */}
                  {hasChildren && (
                    <button
                      type="button"
                      onClick={() => setBrowseCarpetaId(c.id)}
                      className="flex size-6 shrink-0 items-center justify-center rounded text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
                      aria-label={t('entrar_carpeta')}
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
