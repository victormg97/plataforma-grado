'use client';

/**
 * Lazy entry point of the editor. Other components import this file, never
 * `CedularioRichEditor` directly, so the TipTap chunk is loaded only when an editor is
 * rendered and stays out of the initial Programas page load (Req 16.10).
 */

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';

function EditorCargando() {
  const t = useTranslations('cedularios');
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-40 rounded-md border border-input bg-background p-3 text-sm text-muted-foreground"
    >
      {t('editor.cargando_editor')}
    </div>
  );
}

export const CedularioRichEditorLazy = dynamic(
  () => import('./CedularioRichEditor').then((modulo) => modulo.CedularioRichEditor),
  { ssr: false, loading: () => <EditorCargando /> },
);

export type { CedularioRichEditorProps } from './CedularioRichEditor';
