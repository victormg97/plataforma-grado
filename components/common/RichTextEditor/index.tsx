'use client';

import { useState, useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Extension, type CommandProps } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import { TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import OrderedList from '@tiptap/extension-ordered-list';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { useTranslations } from 'next-intl';
import { LinkModal } from '@/components/notas/LinkModal';
import { EditorToolbar } from './components/EditorToolbar';
import { EditorBubbleMenu } from './components/EditorBubbleMenu';
import { LinkPopover } from './components/LinkPopover';

// ─── Extend Commands type for indent/outdent ─────────────────────────────────
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType;
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

export interface RichTextEditorProps {
  content?: string;
  placeholder?: string;
  onChange?: (html: string) => void;
  readOnly?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RichTextEditor({ content, placeholder, onChange, readOnly = false }: RichTextEditorProps) {
  const t = useTranslations('notas');
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkModalInitial, setLinkModalInitial] = useState({ url: '', text: '' });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false, // We configure Link separately below with custom options
        orderedList: false, // We configure OrderedList separately to support type attribute
      }),
      OrderedList.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            type: {
              default: null,
              parseHTML: (element) => element.getAttribute('type'),
              renderHTML: (attributes) => {
                if (!attributes.type) return {};
                return { type: attributes.type, style: `list-style-type: ${attributes.type === 'I' ? 'upper-roman' : attributes.type === 'a' ? 'lower-alpha' : 'decimal'}` };
              },
            },
          };
        },
      }),
      Placeholder.configure({ placeholder: placeholder ?? t('placeholder') }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-[var(--color-brand-gold)] underline cursor-pointer',
          rel: 'noopener noreferrer nofollow',
        },
      }).extend({
        inclusive: false,
      }),
      TextStyleKit,
      TextAlign.configure({ types: ['paragraph', 'heading'] }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      IndentExtension,
    ],
    content: content ?? '',
    immediatelyRender: false,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'max-w-none min-h-[100px] px-3 py-2 focus:outline-none text-[var(--color-text-primary)] text-sm',
      },
    },
  });

  // Sync content when it changes externally (e.g. locale switch)
  useEffect(() => {
    if (!editor) return;
    const currentHTML = editor.getHTML();
    const newContent = content ?? '';
    if (currentHTML !== newContent) {
      editor.commands.setContent(newContent, { emitUpdate: false });
    }
  }, [content, editor]);

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
    <div className="relative rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]">
      {!readOnly && <EditorToolbar editor={editor} onOpenLinkModal={openLinkModal} />}
      <EditorContent editor={editor} />
      {!readOnly && <EditorBubbleMenu editor={editor} onOpenLinkModal={openLinkModal} />}
      {!readOnly && <LinkPopover editor={editor} />}
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
