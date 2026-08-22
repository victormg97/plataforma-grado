'use client';

import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
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
}

export function SimpleRichEditor({
  content,
  placeholder,
  onChange,
  readOnly = false,
  className,
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
      <EditorContent editor={editor} />
    </div>
  );
}
