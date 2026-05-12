'use client';

import { useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Extension, type CommandProps } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { useTranslations } from 'next-intl';
import { LinkModal } from '@/components/notas/LinkModal';
import { EditorToolbar } from './components/EditorToolbar';

// ─── Extend Commands type for indent/outdent ─────────────────────────────────
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      /** Increase indentation (or sink list item) */
      indent: () => ReturnType;
      /** Decrease indentation (or lift list item) */
      outdent: () => ReturnType;
    };
  }
}

// ─── Custom Indent extension ──────────────────────────────────────────────────
const IndentExtension = Extension.create({
  name: 'indent',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          indent: {
            default: 0,
            renderHTML: (attributes) => {
              const level = attributes.indent as number;
              if (!level || level === 0) return {};
              return { style: `padding-left: ${level * 1.5}rem` };
            },
            parseHTML: (element) => {
              const pl = element.style.paddingLeft;
              if (!pl) return 0;
              return Math.round(parseFloat(pl) / 1.5);
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      indent:
        () =>
        ({ state, commands }: CommandProps) => {
          const { $from } = state.selection;
          if ($from.parent.type.name === 'listItem') {
            return commands.sinkListItem('listItem');
          }
          const node = $from.parent;
          const current = (node.attrs.indent as number) ?? 0;
          return commands.updateAttributes(node.type.name, {
            indent: Math.min(current + 1, 8),
          });
        },
      outdent:
        () =>
        ({ state, commands }: CommandProps) => {
          const { $from } = state.selection;
          if ($from.parent.type.name === 'listItem') {
            return commands.liftListItem('listItem');
          }
          const node = $from.parent;
          const current = (node.attrs.indent as number) ?? 0;
          return commands.updateAttributes(node.type.name, {
            indent: Math.max(current - 1, 0),
          });
        },
    };
  },
});

// ─── Types ────────────────────────────────────────────────────────────────────

type NotaEditorProps = {
  contenido?: string;
  placeholder?: string;
  onSubmit: (html: string) => void;
  onCancel?: () => void;
  loading?: boolean;
  submitLabel?: string;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function NotaEditor({ contenido, placeholder, onSubmit, onCancel, loading, submitLabel }: NotaEditorProps) {
  const t = useTranslations('notas');
  const [isEmpty, setIsEmpty] = useState(!contenido);
  const [, setTick] = useState(0);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkModalInitial, setLinkModalInitial] = useState({ url: '', text: '' });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? t('placeholder'),
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-[var(--color-brand-gold)] underline cursor-pointer',
          rel: 'noopener noreferrer nofollow',
        },
      }),
      TextAlign.configure({
        types: ['paragraph', 'heading'],
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      IndentExtension,
    ],
    content: contenido ?? '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      setIsEmpty(editor.isEmpty);
    },
    onTransaction: () => {
      setTick((t) => t + 1);
    },
    editorProps: {
      attributes: {
        class:
          'max-w-none min-h-[100px] px-3 py-2 focus:outline-none text-[var(--color-text-primary)] text-sm',
      },
    },
  });

  const handleSubmit = () => {
    if (!editor || editor.isEmpty) return;
    onSubmit(editor.getHTML());
    if (!contenido) {
      editor.commands.clearContent();
      setIsEmpty(true);
    }
  };

  const openLinkModal = useCallback(() => {
    if (!editor) return;
    if (editor.isActive('link')) {
      const attrs = editor.getAttributes('link');
      const { from, to } = editor.state.selection;
      const selectedText = editor.state.doc.textBetween(from, to, '');
      setLinkModalInitial({ url: attrs.href ?? '', text: selectedText });
    } else {
      const { from, to } = editor.state.selection;
      const selectedText = editor.state.doc.textBetween(from, to, '');
      setLinkModalInitial({ url: '', text: selectedText });
    }
    setLinkModalOpen(true);
  }, [editor]);

  const handleLinkConfirm = useCallback((href: string, text: string) => {
    if (!editor) return;
    setLinkModalOpen(false);
    const { from, to } = editor.state.selection;
    const hasSelection = from !== to;
    if (text && (!hasSelection || text !== editor.state.doc.textBetween(from, to, ''))) {
      editor.chain().focus().deleteSelection().insertContent(`<a href="${href}">${text}</a>`).run();
    } else {
      editor.chain().focus().setLink({ href }).run();
    }
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] overflow-hidden">
      {/* Toolbar */}
      <EditorToolbar editor={editor} onOpenLinkModal={openLinkModal} />

      {/* Editor */}
      <EditorContent editor={editor} />

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-3 py-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded-[var(--radius-sm)]"
          >
            {t('cancelar')}
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || isEmpty}
          className="flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px]"
        >
          {loading ? (
            <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : null}
          {submitLabel ?? t('guardar_nota')}
        </button>
      </div>

      {/* Link modal */}
      {linkModalOpen && (
        <LinkModal
          onClose={() => setLinkModalOpen(false)}
          onConfirm={handleLinkConfirm}
          initialUrl={linkModalInitial.url}
          initialText={linkModalInitial.text}
        />
      )}
    </div>
  );
}
