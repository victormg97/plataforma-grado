'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
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
  const textColorBtnRef = useRef<HTMLDivElement>(null);
  const highlightBtnRef = useRef<HTMLDivElement>(null);

  // Force local re-render on editor transactions so active states update.
  // This is scoped to the toolbar only — doesn't block page navigation.
  const [, setTick] = useState(0);
  useEffect(() => {
    const handler = () => setTick(t => t + 1);
    editor.on('transaction', handler);
    return () => { editor.off('transaction', handler); };
  }, [editor]);

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

  // Font family options
  const fontFamilyOptions = useMemo(() => [
    { value: '', label: t('fuente_defecto'), className: 'text-sm' },
    { value: 'Inter, sans-serif', label: 'Inter', className: 'text-sm font-[Inter]' },
    { value: 'Georgia, serif', label: 'Georgia', className: 'text-sm font-serif' },
    { value: 'monospace', label: 'Monospace', className: 'text-sm font-mono' },
    { value: 'system-ui, sans-serif', label: 'System UI', className: 'text-sm' },
    { value: 'Arial, sans-serif', label: 'Arial', className: 'text-sm' },
    { value: 'Times New Roman, serif', label: 'Times New Roman', className: 'text-sm font-serif' },
    { value: 'Courier New, monospace', label: 'Courier New', className: 'text-sm font-mono' },
  ], [t]);

  const currentFontFamily = editor.getAttributes('textStyle').fontFamily ?? '';

  // Font size options
  const fontSizeOptions = useMemo(() => [
    { value: '', label: t('tamano_defecto'), className: 'text-sm' },
    { value: '12px', label: '12', className: 'text-[12px]' },
    { value: '14px', label: '14', className: 'text-[14px]' },
    { value: '16px', label: '16', className: 'text-[16px]' },
    { value: '18px', label: '18', className: 'text-[18px]' },
    { value: '20px', label: '20', className: 'text-[20px]' },
    { value: '24px', label: '24', className: 'text-[24px]' },
    { value: '28px', label: '28', className: 'text-[28px]' },
    { value: '32px', label: '32', className: 'text-[32px]' },
  ], [t]);

  const currentFontSize = editor.getAttributes('textStyle').fontSize ?? '';

  const handleFontFamilyChange = (val: string) => {
    if (val) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor.chain().focus() as any).setFontFamily(val).run();
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor.chain().focus() as any).unsetFontFamily().run();
    }
  };

  const handleFontSizeChange = (val: string) => {
    if (val) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor.chain().focus() as any).setFontSize(val).run();
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor.chain().focus() as any).unsetFontSize().run();
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

      {/* ── Font family ── */}
      <HeadingSelect
        value={currentFontFamily}
        onChange={handleFontFamilyChange}
        options={fontFamilyOptions}
      />

      {/* ── Font size ── */}
      <HeadingSelect
        value={currentFontSize}
        onChange={handleFontSizeChange}
        options={fontSizeOptions}
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
      <div className="relative" ref={textColorBtnRef}>
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
            triggerRef={textColorBtnRef}
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
      <div className="relative" ref={highlightBtnRef}>
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
            triggerRef={highlightBtnRef}
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
        active={editor.isActive('orderedList') && !editor.getAttributes('orderedList').type}
        title={t('lista_numerada')}
      >
        <ListOrdered className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => {
          if (editor.isActive('orderedList') && editor.getAttributes('orderedList').type === 'I') {
            editor.chain().focus().toggleOrderedList().run();
          } else {
            editor.chain().focus().toggleOrderedList().updateAttributes('orderedList', { type: 'I' }).run();
          }
        }}
        active={editor.isActive('orderedList') && editor.getAttributes('orderedList').type === 'I'}
        title={t('lista_romana')}
      >
        <span className="text-[11px] font-bold leading-none">I.</span>
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
