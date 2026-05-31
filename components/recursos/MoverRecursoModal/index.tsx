'use client';

import { Folder, FolderOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { cn } from '@/lib/utils';
import type { CarpetaItem } from '@/components/recursos/CarpetaCard';
import type { RecursoItem } from '@/components/recursos/RecursoCard';

interface MoverRecursoModalProps {
  recurso: RecursoItem;
  carpetas: CarpetaItem[];
  onClose: () => void;
  onMove: (carpetaId: string | null) => Promise<void>;
  moving: boolean;
}

export function MoverRecursoModal({ recurso, carpetas, onClose, onMove, moving }: MoverRecursoModalProps) {
  const t = useTranslations('recursos');

  // Only show root-level folders (no nesting in the picker for simplicity)
  const rootCarpetas = carpetas.filter((c) => !c.parent_id);

  return (
    <Modal
      open
      onClose={onClose}
      title={t('mover_recurso')}
      description={recurso.titulo}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={moving}>{t('cancelar')}</Button>
        </div>
      }
    >
      <div className="space-y-1.5">
        {/* Root (no folder) option */}
        <button
          type="button"
          onClick={() => onMove(null)}
          disabled={moving || recurso.carpeta_id === null}
          className={cn(
            'flex w-full items-center gap-3 rounded-[var(--radius-md)] border px-4 py-3 text-sm font-medium transition-colors text-left',
            recurso.carpeta_id === null
              ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)] cursor-default'
              : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:border-[var(--color-border-strong)]',
          )}
        >
          <FolderOpen className="size-4 shrink-0" />
          {t('sin_carpeta')}
          {recurso.carpeta_id === null && (
            <span className="ml-auto text-xs">{t('ubicacion_actual')}</span>
          )}
        </button>

        {rootCarpetas.length === 0 && (
          <p className="py-4 text-center text-sm text-[var(--color-text-muted)]">{t('sin_carpetas')}</p>
        )}

        {rootCarpetas.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onMove(c.id)}
            disabled={moving || recurso.carpeta_id === c.id}
            className={cn(
              'flex w-full items-center gap-3 rounded-[var(--radius-md)] border px-4 py-3 text-sm font-medium transition-colors text-left',
              recurso.carpeta_id === c.id
                ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)] cursor-default'
                : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:border-[var(--color-border-strong)]',
            )}
          >
            <Folder className="size-4 shrink-0 text-[var(--color-brand-gold)]" />
            {c.nombre}
            {recurso.carpeta_id === c.id && (
              <span className="ml-auto text-xs">{t('ubicacion_actual')}</span>
            )}
          </button>
        ))}
      </div>
    </Modal>
  );
}
