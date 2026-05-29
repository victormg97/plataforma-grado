'use client';

import type { Editor } from '@tiptap/react';
import {
  Bold, Italic, Strikethrough, List, ListOrdered,
  Link as LinkIcon, Undo, Redo, Code,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  IndentIncrease, IndentDecrease,
  Quote, Table as TableIcon,
  ChevronDown,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ToolbarButton } from './ToolbarButton';
import { Divider } from './Divider';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EditorToolbarProps {
  editor: Editor;
  onOpenLinkModal: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EditorToolbar({ editor, onOpenLinkModal }: EditorToolbarProps) {
  const t = useTranslations('notas');

  // Heading dropdown value
  const headingValue = editor.isActive('heading', { level: 1 })
    ? '1'
    : editor.isActive('heading', { level: 2 })
    ? '2'
    : editor.isActive('heading', { level: 3 })
    ? '3'
    : '0';

  return (
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
        <ChevronDown className="pointer-events-none absolute right-1.5 size-3 text-[var(--color-text-muted)]" />
      </div>

      <Divider />

      {/* ── Formatting ── */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title={t('negrita')}
      >
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title={t('cursiva')}
      >
        <Italic className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        title={t('tachado')}
      >
        <Strikethrough className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        title={t('codigo')}
      >
        <Code className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        title={t('cita')}
      >
        <Quote className="size-4" />
      </ToolbarButton>

      <Divider />

      {/* ── Alignment ── */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        active={editor.isActive({ textAlign: 'left' })}
        title={t('alinear_izquierda')}
      >
        <AlignLeft className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        active={editor.isActive({ textAlign: 'center' })}
        title={t('alinear_centro')}
      >
        <AlignCenter className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        active={editor.isActive({ textAlign: 'right' })}
        title={t('alinear_derecha')}
      >
        <AlignRight className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        active={editor.isActive({ textAlign: 'justify' })}
        title={t('alinear_justificar')}
      >
        <AlignJustify className="size-4" />
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
        <IndentIncrease className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (editor!.chain().focus() as any).outdent().run();
        }}
        title={t('sangria_reducir')}
      >
        <IndentDecrease className="size-4" />
      </ToolbarButton>

      <Divider />

      {/* ── Lists ── */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title={t('lista')}
      >
        <List className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title={t('lista_numerada')}
      >
        <ListOrdered className="size-4" />
      </ToolbarButton>

      <Divider />

      {/* ── Insert ── */}
      <ToolbarButton
        onClick={onOpenLinkModal}
        active={editor.isActive('link')}
        title={t('enlace')}
      >
        <LinkIcon className="size-4" />
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
        <TableIcon className="size-4" />
      </ToolbarButton>

      <Divider />

      {/* ── History ── */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title={t('deshacer')}
      >
        <Undo className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title={t('rehacer')}
      >
        <Redo className="size-4" />
      </ToolbarButton>
    </div>
  );
}
