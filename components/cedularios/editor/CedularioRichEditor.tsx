'use client';

/**
 * TipTap v3 rich-text editor for cedulario content (normativa, rúbrica, temario).
 *
 * - Content is TipTap JSON in and out (`content: doc`, `editor.getJSON()`), never HTML.
 * - Headings 1-6, bold, italic, underline, strike, nestable lists, links (http, https, mailto),
 *   undo/redo with depth 100 and the default keyboard shortcuts.
 * - Tables only for the `con_tablas` variant (temario).
 * - Pasted content goes through the ProseMirror schema, which drops every node and mark the
 *   schema does not define and keeps their text (Req 13.9). `sanitizeDoc` runs again before
 *   `onChange` (Req 13.10).
 * - `readOnly` renders the same JSON in an `editable: false` instance: no toolbar, no raw HTML,
 *   no `dangerouslySetInnerHTML` (Req 13.14, 16.7).
 * - `variante` is fixed for the lifetime of the instance. Change the React `key` to switch it.
 *
 * Import `CedularioRichEditorLazy` from other components so this chunk stays out of the
 * initial Programas load.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { EditorContent, useEditor } from '@tiptap/react';
import type { Extensions } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';

import { cn } from '@/lib/utils';
import { docVacio, sanitizeDoc, type TiptapDoc, type VarianteRichText } from '@/lib/cedularios/richtext';

import { EditorToolbar } from './EditorToolbar';
import { esUrlEnlacePermitida } from './enlaces-permitidos';

export interface CedularioRichEditorProps {
  /** `con_tablas` for temario, `sin_tablas` for normativa and rúbrica. */
  variante: VarianteRichText;
  /** Document to show. `null` is an empty field. Only read when the instance is created and on `revisionExterna` changes. */
  contenido: TiptapDoc | null;
  /** Called with the sanitized document on every edit. */
  onChange?: (doc: TiptapDoc) => void;
  /** `editable: false`, no toolbar. */
  readOnly?: boolean;
  /** Key relative to the `cedularios` namespace, for example `normativa.placeholder`. */
  placeholderKey?: string;
  /** Called when the editor gains focus (presence). */
  onFocus?: () => void;
  /** Called when the editor loses focus (presence). */
  onBlur?: () => void;
  /**
   * Increments each time `contenido` was replaced from outside (remote change, Refresh).
   * The editor then calls `setContent(contenido)` without emitting an update.
   */
  revisionExterna?: number;
  /** Accessible name of the editing area. Defaults to `editor.contenido_aria` or `editor.contenido_solo_lectura_aria`. */
  ariaLabel?: string;
  className?: string;
}

const REL_ENLACE = 'noopener noreferrer nofollow';

function crearExtensiones(variante: VarianteRichText, leerPlaceholder: () => string): Extensions {
  const extensiones: Extensions = [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      undoRedo: { depth: 100 },
      // Not part of the cedulario schema: pasted blocks of these types fall back to paragraphs.
      blockquote: false,
      code: false,
      codeBlock: false,
      horizontalRule: false,
      trailingNode: false,
      // Underline and Link ship with StarterKit v3, so they are configured here (no duplicates).
      link: {
        openOnClick: false,
        autolink: false,
        linkOnPaste: false,
        defaultProtocol: 'https',
        HTMLAttributes: { target: '_blank', rel: REL_ENLACE },
        isAllowedUri: (url) => esUrlEnlacePermitida(url),
      },
    }),
    Placeholder.configure({ placeholder: () => leerPlaceholder() }),
  ];

  if (variante === 'con_tablas') {
    extensiones.push(Table.configure({ resizable: false }), TableRow, TableHeader, TableCell);
  }
  return extensiones;
}

export function CedularioRichEditor({
  variante,
  contenido,
  onChange,
  readOnly = false,
  placeholderKey,
  onFocus,
  onBlur,
  revisionExterna = 0,
  ariaLabel,
  className,
}: CedularioRichEditorProps) {
  const t = useTranslations('cedularios');

  const placeholderTexto = placeholderKey ? t(placeholderKey) : '';
  const etiquetaAria =
    ariaLabel ?? (readOnly ? t('editor.contenido_solo_lectura_aria') : t('editor.contenido_aria'));

  // Latest values for callbacks that ProseMirror keeps for the lifetime of the editor.
  const placeholderRef = useRef(placeholderTexto);
  const ariaRef = useRef(etiquetaAria);
  const readOnlyRef = useRef(readOnly);
  const onChangeRef = useRef(onChange);
  const onFocusRef = useRef(onFocus);
  const onBlurRef = useRef(onBlur);
  const contenidoRef = useRef(contenido);
  const varianteRef = useRef(variante);

  useEffect(() => {
    placeholderRef.current = placeholderTexto;
    ariaRef.current = etiquetaAria;
    readOnlyRef.current = readOnly;
    onChangeRef.current = onChange;
    onFocusRef.current = onFocus;
    onBlurRef.current = onBlur;
    contenidoRef.current = contenido;
    varianteRef.current = variante;
  });

  // The placeholder getter only runs inside ProseMirror decorations, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [extensiones] = useState(() => crearExtensiones(variante, () => placeholderRef.current));
  const [contenidoInicial] = useState(() => sanitizeDoc(contenido ?? docVacio(), variante));

  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: extensiones,
    content: contenidoInicial,
    editorProps: {
      attributes: () => ({
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': ariaRef.current,
        'aria-readonly': readOnlyRef.current ? 'true' : 'false',
      }),
    },
    onUpdate: ({ editor: ed }) => {
      if (!ed.isEditable) return;
      onChangeRef.current?.(sanitizeDoc(ed.getJSON(), varianteRef.current));
    },
    onFocus: () => onFocusRef.current?.(),
    onBlur: () => onBlurRef.current?.(),
  });

  // Permission changes: keep the instance (and its text), only toggle editing.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (editor.isEditable === !readOnly) return;
    editor.setEditable(!readOnly, false);
  }, [editor, readOnly]);

  // Content replaced from outside (silent remote apply or Refresh): no update event, so no loop.
  const revisionAplicadaRef = useRef(revisionExterna);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (revisionAplicadaRef.current === revisionExterna) return;
    revisionAplicadaRef.current = revisionExterna;
    editor.commands.setContent(sanitizeDoc(contenidoRef.current ?? docVacio(), varianteRef.current), {
      emitUpdate: false,
    });
  }, [editor, revisionExterna]);

  return (
    <div
      data-readonly={readOnly ? 'true' : 'false'}
      className={cn(
        'overflow-hidden rounded-md',
        !readOnly &&
          'border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30',
        className,
      )}
    >
      {!readOnly && editor && <EditorToolbar editor={editor} variante={variante} />}

      {!editor && <p className="p-3 text-sm text-muted-foreground">{t('editor.cargando_editor')}</p>}

      <EditorContent
        editor={editor}
        className={cn(
          '[&_.ProseMirror]:break-words [&_.ProseMirror]:outline-none',
          readOnly
            ? '[&_.ProseMirror]:py-1'
            : '[&_.ProseMirror]:min-h-40 [&_.ProseMirror]:px-3 [&_.ProseMirror]:py-2',
          // Heading levels 4-6 (globals.css only styles 1-3).
          '[&_h4]:mt-2 [&_h4]:mb-1 [&_h4]:text-base [&_h4]:font-semibold',
          '[&_h5]:mt-2 [&_h5]:mb-1 [&_h5]:text-sm [&_h5]:font-semibold',
          '[&_h6]:mt-2 [&_h6]:mb-1 [&_h6]:text-sm [&_h6]:font-medium [&_h6]:text-muted-foreground',
          '[&_.selectedCell]:bg-primary/10',
        )}
      />
    </div>
  );
}
