'use client';

import { useMemo, useState } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Bold, Italic, Strikethrough, List, ListOrdered,
  Link as LinkIcon, Undo, Redo, Code,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  IndentIncrease, IndentDecrease,
  Quote, Palette, Highlighter,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ToolbarButton } from './ToolbarButton';
import { HeadingSelect } from './HeadingSelect';
import { TableSizePicker } from './TableSizePicker';
import { ColorPickerPanel } from './ColorPickerPanel';
import { Divider } from './Divider';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EditorToolbarProps {
  editor: Editor;
  onOpenLinkModal: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EditorToolbar({ editor, onOpenLinkModal }: EditorToolbarProps) {
  const t = useTranslations('notas');
  const [showTextColor, setShowTextColor] = useState(false);
  const [showHighlight, setShowHighlight] = useState(false);

  const currentTextColor = editor.getAttributes('textStyle').color ?? '';
  const currentBgColor = editor.getAttributes('textStyle').backgroundColor ?? '';

  // Heading dropdown value
  const headingValue = editor.isActive('heading', { level: 1 })
    ? '1'
    : editor.isActive('heading', { level: 2 })
    ? '2'
    : editor.isActive('heading', { level: 3 })
    ? '3'
    : '0';

  // Heading options with size classes matching the rendered note output
  const headingOptions = useMemo(() => [
    { value: '0', label: t('parrafo'), className: 'text-sm' },
    { value: '1', label: t('titulo_1'), className: 'text-xl font-bold' },
    { value: '2', label: t('titulo_2'), className: 'text-lg font-bold' },
    { value: '3', label: t('titulo_3'), className: 'text-base font-semibold' },
  ], [t]);

  const handleHeadingChange = (val: string) => {
    if (val === '0') {
      editor.chain().focus().setParagraph().run();
    } else {
      editor
        .chain()
        .focus()
        .toggleHeading({ level: parseInt(val) as 1 | 2 | 3 })
        .run();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--color-border)] px-2 py-1.5 bg-[var(--color-bg-secondary)]">

      {/* ── Heading dropdown ── */}
      <HeadingSelect
        value={headingValue}
        onChange={handleHeadingChange}
        options={headingOptions}
      />

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

      {/* ── Colors ── */}
      <div className="relative">
        <ToolbarButton
          onClick={() => { setShowHighlight(false); setShowTextColor(!showTextColor); }}
          active={!!currentTextColor}
          title={t('color_texto')}
        >
          <Palette className="size-4" />
        </ToolbarButton>
        {showTextColor && (
          <ColorPickerPanel
            mode="text"
            currentColor={currentTextColor}
            onSelect={(color) => {
              if (color) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (editor.chain().focus() as any).setColor(color).run();
              } else {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (editor.chain().focus() as any).unsetColor().run();
              }
            }}
            onClose={() => setShowTextColor(false)}
          />
        )}
      </div>
      <div className="relative">
        <ToolbarButton
          onClick={() => { setShowTextColor(false); setShowHighlight(!showHighlight); }}
          active={!!currentBgColor}
          title={t('resaltar')}
        >
          <Highlighter className="size-4" />
        </ToolbarButton>
        {showHighlight && (
          <ColorPickerPanel
            mode="background"
            currentColor={currentBgColor}
            onSelect={(color) => {
              if (color) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (editor.chain().focus() as any).setBackgroundColor(color).run();
              } else {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (editor.chain().focus() as any).unsetBackgroundColor().run();
              }
            }}
            onClose={() => setShowHighlight(false)}
          />
        )}
      </div>

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
      <TableSizePicker
        onInsert={(rows, cols) =>
          editor
            .chain()
            .focus()
            .insertTable({ rows, cols, withHeaderRow: true })
            .run()
        }
      />

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
