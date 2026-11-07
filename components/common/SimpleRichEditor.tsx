'use client';

import { useEffect } from 'react';
import { useEditor, useEditorState, EditorContent, type Editor } from '@tiptap/react';
import { Bold, Italic, List, ListOrdered, Strikethrough, Underline } from 'lucide-react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

/**
 * Minimal TipTap editor — no toolbar, supports formatting via keyboard shortcuts:
 * - Ctrl+B: bold
 * - Ctrl+I: italic
 * - Ctrl+Shift+7: ordered list
 * - Ctrl+Shift+8: bullet list
 * - Enter: new paragraph / line break
 *
 * Used for class descriptions where full RichTextEditor is overkill.
 */

export interface SimpleRichEditorProps {
  content?: string;
  placeholder?: string;
  onChange?: (html: string) => void;
  readOnly?: boolean;
  className?: string;
  /** Shows a formatting toolbar above the editor (editable mode only). Labels are translated by the caller. */
  toolbarLabels?: SimpleRichEditorToolbarLabels;
  /** Id of the editable element, so an external <label htmlFor> points at it. */
  id?: string;
}

export interface SimpleRichEditorToolbarLabels {
  group: string;
  bold: string;
  italic: string;
  underline: string;
  strike: string;
  bulletList: string;
  orderedList: string;
}

export function SimpleRichEditor({
  content,
  placeholder,
  onChange,
  readOnly = false,
  className,
  toolbarLabels,
  id,
}: SimpleRichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder: placeholder ?? '',
      }),
    ],
    content: content ?? '',
    immediatelyRender: false,
    editable: !readOnly,
    onUpdate: ({ editor: ed }) => {
      onChange?.(ed.getHTML());
    },
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        class: readOnly
          ? 'prose-sm max-w-none text-sm text-[var(--color-text-secondary)] [&_p]:mb-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mb-0.5 [&_strong]:font-semibold [&_em]:italic'
          : 'max-w-none min-h-[80px] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none [&_p]:mb-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mb-0.5',
      },
    },
  });

  // Sync content when it changes externally
  useEffect(() => {
    if (!editor) return;
    const currentHTML = editor.getHTML();
    const newContent = content ?? '';
    // Avoid resetting cursor position if content hasn't actually changed
    if (currentHTML !== newContent) {
      editor.commands.setContent(newContent, { emitUpdate: false });
    }
  }, [content, editor]);

  // Sync editable state
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [readOnly, editor]);

  if (!editor) return null;

  if (readOnly) {
    return (
      <div className={className}>
        <EditorContent editor={editor} />
      </div>
    );
  }

  return (
    <div
      className={`rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] focus-within:border-[var(--color-brand-gold)] focus-within:ring-1 focus-within:ring-[var(--color-brand-gold)] ${className ?? ''}`}
    >
      {toolbarLabels && <SimpleRichEditorToolbar editor={editor} labels={toolbarLabels} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function SimpleRichEditorToolbar({ editor, labels }: { editor: Editor; labels: SimpleRichEditorToolbarLabels }) {
  const activo = useEditorState({
    editor,
    selector: ({ editor: ed }) => ({
      bold: ed.isActive('bold'),
      italic: ed.isActive('italic'),
      underline: ed.isActive('underline'),
      strike: ed.isActive('strike'),
      bulletList: ed.isActive('bulletList'),
      orderedList: ed.isActive('orderedList'),
    }),
  });

  const botones = [
    { key: 'bold', label: labels.bold, icon: Bold, on: activo.bold, run: () => editor.chain().focus().toggleBold().run() },
    { key: 'italic', label: labels.italic, icon: Italic, on: activo.italic, run: () => editor.chain().focus().toggleItalic().run() },
    { key: 'underline', label: labels.underline, icon: Underline, on: activo.underline, run: () => editor.chain().focus().toggleUnderline().run() },
    { key: 'strike', label: labels.strike, icon: Strikethrough, on: activo.strike, run: () => editor.chain().focus().toggleStrike().run() },
    { key: 'bulletList', label: labels.bulletList, icon: List, on: activo.bulletList, run: () => editor.chain().focus().toggleBulletList().run() },
    { key: 'orderedList', label: labels.orderedList, icon: ListOrdered, on: activo.orderedList, run: () => editor.chain().focus().toggleOrderedList().run() },
  ];

  return (
    <div role="toolbar" aria-label={labels.group} className="flex flex-wrap items-center gap-0.5 border-b border-[var(--color-border)] px-1.5 py-1">
      {botones.map(({ key, label, icon: Icono, on, run }) => (
        <button
          key={key}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={run}
          aria-label={label}
          aria-pressed={on}
          title={label}
          className={`flex size-7 items-center justify-center rounded-[var(--radius-sm)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)] ${on ? 'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]'}`}
        >
          <Icono className="size-4" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
