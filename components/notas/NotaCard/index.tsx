'use client';

import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { Pencil, Trash2, User } from 'lucide-react';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { NotaEditor } from '@/components/notas/NotaEditor';
import { LinkWarningModal } from '@/components/notas/LinkWarningModal';
import type { NotaClaseConAutor } from '@/lib/supabase/types';

// ─── localStorage helpers for trusted professors ──────────────────────────────
const TRUST_KEY = 'nota_trusted_professors';

function getTrustedProfessors(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(TRUST_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function trustProfessor(id: string) {
  const list = getTrustedProfessors();
  if (!list.includes(id)) {
    localStorage.setItem(TRUST_KEY, JSON.stringify([...list, id]));
  }
}

function isProfessorTrusted(id: string): boolean {
  return getTrustedProfessors().includes(id);
}
// ─────────────────────────────────────────────────────────────────────────────

type PendingLink = { url: string };

type NotaCardProps = {
  nota: NotaClaseConAutor;
  isOwn: boolean;
  onUpdate: (id: string, contenido: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  updating?: boolean;
  deleting?: boolean;
};

export function NotaCard({ nota, isOwn, onUpdate, onDelete, updating, deleting }: NotaCardProps) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingLink, setPendingLink] = useState<PendingLink | null>(null);
  const t = useTranslations('notas');
  const locale = useLocale();
  const dateFnsLocale = locale === 'en' ? enUS : es;

  const handleContentClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const anchor = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      // Only intercept http/https links
      if (!href.startsWith('http://') && !href.startsWith('https://')) return;

      e.preventDefault();
      e.stopPropagation();

      const isProfesor = nota.autor.rol === 'profesor';

      // If the author is a trusted professor, open directly
      if (isProfesor && isProfessorTrusted(nota.autor_id)) {
        window.open(href, '_blank', 'noopener,noreferrer');
        return;
      }

      setPendingLink({ url: href });
    },
    [nota.autor_id, nota.autor.rol]
  );

  const handleWarningConfirm = useCallback(
    (trust: boolean) => {
      if (!pendingLink) return;
      if (trust && nota.autor.rol === 'profesor') {
        trustProfessor(nota.autor_id);
      }
      window.open(pendingLink.url, '_blank', 'noopener,noreferrer');
      setPendingLink(null);
    },
    [pendingLink, nota.autor_id, nota.autor.rol]
  );

  const handleUpdate = async (html: string) => {
    await onUpdate(nota.id, html);
    setEditing(false);
  };

  const handleDelete = async () => {
    await onDelete(nota.id);
    setConfirmDelete(false);
  };

  const rolLabel = nota.autor.rol === 'profesor' ? t('profesor') : t('alumno');
  const authorFullName = `${nota.autor.nombre} ${nota.autor.apellido}`.trim();

  return (
    <>
    {pendingLink && (
      <LinkWarningModal
        url={pendingLink.url}
        authorName={authorFullName}
        authorId={nota.autor_id}
        authorRole={nota.autor.rol}
        onConfirm={handleWarningConfirm}
        onCancel={() => setPendingLink(null)}
      />
    )}
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--color-bg-secondary)]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-gold-muted)]">
            {nota.autor.avatar_url ? (
              <Image src={nota.autor.avatar_url} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <User className="h-3.5 w-3.5 text-[var(--color-brand-gold)]" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
              {nota.autor.nombre} {nota.autor.apellido}
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)]">
              {rolLabel} · {format(new Date(nota.created_at), locale === 'en' ? "MMM d, yyyy 'at' HH:mm" : "d MMM yyyy, HH:mm", { locale: dateFnsLocale })}
              {nota.updated_at !== nota.created_at && ` · ${t('editada')}`}
            </p>
          </div>
        </div>

        {isOwn && !editing && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center justify-center h-7 w-7 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-primary)] hover:text-[var(--color-text-primary)]"
              title={t('editar')}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex items-center justify-center h-7 w-7 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-red-50 hover:text-[var(--color-error)] dark:hover:bg-red-950/20"
              title={t('eliminar')}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {editing ? (
        <div className="p-3">
          <NotaEditor
            contenido={nota.contenido}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(false)}
            loading={updating}
            submitLabel={t('actualizar')}
          />
        </div>
      ) : (
        <div
          className="tiptap-content max-w-none px-3 py-2 text-sm text-[var(--color-text-primary)]"
          dangerouslySetInnerHTML={{ __html: nota.contenido }}
          onClick={handleContentClick}
        />
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] px-3 py-2 bg-red-50 dark:bg-red-950/20">
          <p className="text-sm text-[var(--color-error)]">{t('confirmar_eliminar')}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              {t('cancelar')}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--color-error)] px-3 py-1 text-sm text-white hover:opacity-90 disabled:opacity-50"
            >
              {deleting ? (
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : null}
              {t('eliminar')}
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
