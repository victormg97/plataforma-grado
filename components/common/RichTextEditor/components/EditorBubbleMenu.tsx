'use client';

import { useCallback, useState } from 'react';
import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import {
  Bold, Italic, Strikethrough, Code, Highlighter,
  Link as LinkIcon, Palette, RemoveFormatting,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Tooltip } from '@/components/common/Tooltip';
import { ColorPickerPanel } from './ColorPickerPanel';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EditorBubbleMenuProps {
  editor: Editor;
  onOpenLinkModal: () => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BubbleButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip content={title} position="top" variant="subtle">
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          onClick();
        }}
        disabled={disabled}
        aria-label={title}
        className={`flex items-center justify-center size-7 rounded-[var(--radius-sm)] transition-colors
          ${active
            ? 'bg-[var(--color-brand-gold)] text-white'
            : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]'
          }
          disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {children}
      </button>
    </Tooltip>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EditorBubbleMenu({ editor, onOpenLinkModal }: EditorBubbleMenuProps) {
  const t = useTranslations('notas');
  const [showTextColor, setShowTextColor] = useState(false);
  const [showHighlight, setShowHighlight] = useState(false);

  const closeAll = useCallback(() => {
    setShowTextColor(false);
    setShowHighlight(false);
  }, []);

  const currentTextColor = editor.getAttributes('textStyle').color ?? '';
  const currentBgColor = editor.getAttributes('textStyle').backgroundColor ?? '';

  return (
    <BubbleMenu
      editor={editor}
      options={{
        placement: 'top',
        offset: 8,
        flip: true,
        shift: { padding: 12 },
      }}
      shouldShow={({ editor: ed, state }) => {
        if (state.selection.empty) return false;
        if (ed.isActive('codeBlock')) return false;
        return true;
      }}
    >
      <div
        className="flex items-center gap-0.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-1 py-0.5 shadow-[var(--shadow-lg)] ring-1 ring-black/5 dark:ring-white/5"
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).tagName !== 'INPUT') {
            e.preventDefault();
          }
        }}
      >
        {/* Bold */}
        <BubbleButton
          onClick={() => { closeAll(); editor.chain().focus().toggleBold().run(); }}
          active={editor.isActive('bold')}
          title={t('negrita')}
        >
          <Bold className="size-3.5" />
        </BubbleButton>

        {/* Italic */}
        <BubbleButton
          onClick={() => { closeAll(); editor.chain().focus().toggleItalic().run(); }}
          active={editor.isActive('italic')}
          title={t('cursiva')}
        >
          <Italic className="size-3.5" />
        </BubbleButton>

        {/* Strikethrough */}
        <BubbleButton
          onClick={() => { closeAll(); editor.chain().focus().toggleStrike().run(); }}
          active={editor.isActive('strike')}
          title={t('tachado')}
        >
          <Strikethrough className="size-3.5" />
        </BubbleButton>

        {/* Code */}
        <BubbleButton
          onClick={() => { closeAll(); editor.chain().focus().toggleCode().run(); }}
          active={editor.isActive('code')}
          title={t('codigo')}
        >
          <Code className="size-3.5" />
        </BubbleButton>

        {/* Separator */}
        <div className="h-5 w-px bg-[var(--color-border)] mx-0.5 shrink-0" />

        {/* Text Color */}
        <div className="relative">
          <BubbleButton
            onClick={() => { setShowHighlight(false); setShowTextColor(!showTextColor); }}
            active={!!currentTextColor}
            title={t('color_texto')}
          >
            <Palette className="size-3.5" />
          </BubbleButton>
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

        {/* Background/Highlight */}
        <div className="relative">
          <BubbleButton
            onClick={() => { setShowTextColor(false); setShowHighlight(!showHighlight); }}
            active={!!currentBgColor}
            title={t('resaltar')}
          >
            <Highlighter className="size-3.5" />
          </BubbleButton>
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

        {/* Separator */}
        <div className="h-5 w-px bg-[var(--color-border)] mx-0.5 shrink-0" />

        {/* Link */}
        <BubbleButton
          onClick={() => { closeAll(); onOpenLinkModal(); }}
          active={editor.isActive('link')}
          title={t('enlace')}
        >
          <LinkIcon className="size-3.5" />
        </BubbleButton>

        {/* Clear formatting */}
        <BubbleButton
          onClick={() => {
            closeAll();
            editor.chain().focus().unsetAllMarks().run();
          }}
          title={t('limpiar_formato')}
        >
          <RemoveFormatting className="size-3.5" />
        </BubbleButton>
      </div>
    </BubbleMenu>
  );
}
