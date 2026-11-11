'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Edit2, ExternalLink, Trash2 } from 'lucide-react';
import { Tooltip } from '@/components/common/Tooltip';

interface ClaseCardAccionesProps {
  detalleHref: string;
  onEdit: () => void;
  onDelete: () => void;
}

/** Footer of a class card: open detail, edit and delete. Clicks never bubble to the card. */
export function ClaseCardAcciones({ detalleHref, onEdit, onDelete }: ClaseCardAccionesProps) {
  const t = useTranslations('horarios');
  const tc = useTranslations('common');

  return (
    <div className="mt-auto flex justify-end gap-1 border-t border-[var(--color-border)] px-3 py-2">
      <Tooltip content={t('ver_detalle_completo')} position="top">
        <Link
          href={detalleHref}
          onClick={(e) => e.stopPropagation()}
          aria-label={t('ver_detalle_completo')}
          className="inline-flex rounded p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-brand-gold)]"
        >
          <ExternalLink className="size-4" />
        </Link>
      </Tooltip>
      <Tooltip content={tc('editar')} position="top">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          aria-label={tc('editar')}
          className="rounded p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-brand-gold)]"
        >
          <Edit2 className="size-4" />
        </button>
      </Tooltip>
      <Tooltip content={tc('eliminar')} position="top">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label={tc('eliminar')}
          className="rounded p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-red-50 hover:text-[var(--color-error)] dark:hover:bg-red-950/20"
        >
          <Trash2 className="size-4" />
        </button>
      </Tooltip>
    </div>
  );
}
