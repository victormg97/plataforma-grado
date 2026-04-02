'use client';

import { useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Extension, type CommandProps } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import {
  Bold, Italic, Strikethrough, List, ListOrdered,
  Link as LinkIcon, Undo, Redo, Code,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  IndentIncrease, IndentDecrease,
  Quote, Table as TableIcon,
  ChevronDown,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LinkModal } from '@/components/notas/LinkModal';

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
// ─────────────────────────────────────────────────────────────────────────────

type NotaEditorProps = {
  contenido?: string;
  placeholder?: string;
  onSubmit: (html: string) => void;
  onCancel?: () => void;
  loading?: boolean;
  submitLabel?: string;
};

function ToolbarButton({
  onClick,
  active,
  disabled,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      disabled={disabled}
      title={title}
      className={`flex items-center justify-center h-8 w-8 rounded-[var(--radius-sm)] transition-colors
        ${active
          ? 'bg-[var(--color-brand-gold)] text-white'
          : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]'
        }
        disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

const Divider = () => <div className="h-5 w-px bg-[var(--color-border)] mx-1 shrink-0" />;

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

  // Heading dropdown value
  const headingValue = editor.isActive('heading', { level: 1 })
    ? '1'
    : editor.isActive('heading', { level: 2 })
    ? '2'
    : editor.isActive('heading', { level: 3 })
    ? '3'
    : '0';

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--color-border)] px-2 py-1.5 bg-[var(--color-bg-secondary)]">

        {/* ── Heading dropdown ── */}
        <div className="relative flex items-center">
          <select
            value={headingValue}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              editor.chain().focus();
              const val = e.target.value;
              if (val === '0') {
                editor.chain().focus().setParagraph().run();
              } else {
                editor
                  .chain()
                  .focus()
                  .toggleHeading({ level: parseInt(val) as 1 | 2 | 3 })
                  .run();
              }
            }}
            className="h-8 appearance-none rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-primary)] pl-2 pr-6 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-gold)]/30 cursor-pointer hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <option value="0">{t('parrafo')}</option>
            <option value="1">{t('titulo_1')}</option>
            <option value="2">{t('titulo_2')}</option>
            <option value="3">{t('titulo_3')}</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-1.5 h-3 w-3 text-[var(--color-text-muted)]" />
        </div>

        <Divider />

        {/* ── Formatting ── */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title={t('negrita')}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title={t('cursiva')}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title={t('tachado')}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
          title={t('codigo')}
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title={t('cita')}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>

        <Divider />

        {/* ── Alignment ── */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          active={editor.isActive({ textAlign: 'left' })}
          title={t('alinear_izquierda')}
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          active={editor.isActive({ textAlign: 'center' })}
          title={t('alinear_centro')}
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          active={editor.isActive({ textAlign: 'right' })}
          title={t('alinear_derecha')}
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          active={editor.isActive({ textAlign: 'justify' })}
          title={t('alinear_justificar')}
        >
          <AlignJustify className="h-4 w-4" />
        </ToolbarButton>

        <Divider />

        {/* ── Indent ── */}
        <ToolbarButton
          onClick={() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (editor!.chain().focus() as any).indent().run();
          }}
          title={t('sangria_aumentar')}
        >
          <IndentIncrease className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (editor!.chain().focus() as any).outdent().run();
          }}
          title={t('sangria_reducir')}
        >
          <IndentDecrease className="h-4 w-4" />
        </ToolbarButton>

        <Divider />

        {/* ── Lists ── */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title={t('lista')}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title={t('lista_numerada')}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <Divider />

        {/* ── Insert ── */}
        <ToolbarButton
          onClick={openLinkModal}
          active={editor.isActive('link')}
          title={t('enlace')}
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
          title={t('insertar_tabla')}
        >
          <TableIcon className="h-4 w-4" />
        </ToolbarButton>

        <Divider />

        {/* ── History ── */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title={t('deshacer')}
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title={t('rehacer')}
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>
      </div>

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
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
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
