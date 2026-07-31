'use client';

import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/react';
import { ExternalLink, Pencil, Trash2, Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LinkPopoverProps {
  editor: Editor;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LinkPopover({ editor }: LinkPopoverProps) {
  const t = useTranslations('notas');
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const popoverRef = useRef<HTMLDivElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const editingRef = useRef(false);

  // Keep ref in sync so event handlers see latest value
  editingRef.current = editing;

  useEffect(() => { setMounted(true); }, []);

  // Clamp the popover position so it stays within the viewport
  const clampPosition = useCallback((top: number, centerX: number) => {
    const padding = 12;
    const popoverWidth = popoverRef.current?.offsetWidth ?? 280;
    const halfW = popoverWidth / 2;

    let left = centerX;
    // Clamp horizontally
    if (left - halfW < padding) {
      left = halfW + padding;
    } else if (left + halfW > window.innerWidth - padding) {
      left = window.innerWidth - padding - halfW;
    }

    return { top, left };
  }, []);

  const updatePosition = useCallback(() => {
    if (!editor.isActive('link')) {
      setVisible(false);
      return;
    }

    const { view, state } = editor;
    const { from, to } = state.selection;

    // Find the full mark range for the link
    const $from = state.selection.$from;
    const linkMark = $from.marks().find((m) => m.type.name === 'link');
    if (!linkMark) {
      setVisible(false);
      return;
    }

    const start = view.coordsAtPos(from);
    const end = view.coordsAtPos(to);
    const centerX = (start.left + end.left) / 2;
    const bottomY = Math.max(start.bottom, end.bottom);

    setPosition(clampPosition(bottomY + 8, centerX));
    setVisible(true);

    // Get current link attributes
    const attrs = editor.getAttributes('link');
    setUrl(attrs.href ?? '');
    const selectedText = state.doc.textBetween(from, to, '');
    setText(selectedText);
  }, [editor, clampPosition]);

  // Re-clamp after the popover renders (when we know its actual width)
  useLayoutEffect(() => {
    if (!visible || !popoverRef.current) return;
    // Re-clamp with actual width
    const rect = popoverRef.current.getBoundingClientRect();
    const padding = 12;
    const halfW = rect.width / 2;
    const currentLeft = position.left;

    let newLeft = currentLeft;
    if (currentLeft - halfW < padding) {
      newLeft = halfW + padding;
    } else if (currentLeft + halfW > window.innerWidth - padding) {
      newLeft = window.innerWidth - padding - halfW;
    }

    if (newLeft !== currentLeft) {
      setPosition((prev) => ({ ...prev, left: newLeft }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editing]);

  // Listen to selection changes
  useEffect(() => {
    const handleSelectionUpdate = () => {
      // Don't dismiss if we're in edit mode (user is typing in input fields)
      if (editingRef.current) return;

      if (editor.isActive('link')) {
        const { $from } = editor.state.selection;
        const linkMark = $from.marks().find((m) => m.type.name === 'link');
        if (linkMark) {
          updatePosition();
        } else {
          setVisible(false);
        }
      } else {
        setVisible(false);
      }
    };

    const handleBlur = () => {
      // Delay hiding to allow clicking on the popover
      setTimeout(() => {
        if (!popoverRef.current?.contains(document.activeElement)) {
          setVisible(false);
          setEditing(false);
        }
      }, 200);
    };

    editor.on('selectionUpdate', handleSelectionUpdate);
    editor.on('blur', handleBlur);

    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
      editor.off('blur', handleBlur);
    };
  }, [editor, updatePosition]);

  // Close on outside click
  useEffect(() => {
    if (!visible) return;
    const handler = (e: MouseEvent) => {
      if (!popoverRef.current?.contains(e.target as Node)) {
        setVisible(false);
        setEditing(false);
      }
    };
    // Use setTimeout so that click events on popover buttons register first
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [visible]);

  // Focus URL input when entering edit mode
  useEffect(() => {
    if (editing) {
      setTimeout(() => {
        urlInputRef.current?.focus();
        urlInputRef.current?.select();
      }, 50);
    }
  }, [editing]);

  const handleEdit = () => {
    // Mark as editing BEFORE the chain so selectionUpdate doesn't reset us
    editingRef.current = true;
    setEditing(true);

    // Extend selection to the full link range so we can read the text
    editor.chain().focus().extendMarkRange('link').run();

    const attrs = editor.getAttributes('link');
    setUrl(attrs.href ?? '');

    // Now selection covers the full link text
    const { from, to } = editor.state.selection;
    const linkText = editor.state.doc.textBetween(from, to, '');
    setText(linkText);
  };

  const handleSave = () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    const href = trimmedUrl.startsWith('http') ? trimmedUrl : `https://${trimmedUrl}`;

    // Update the link href and optionally the text
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();

    const { from, to } = editor.state.selection;
    const currentText = editor.state.doc.textBetween(from, to, '');
    if (text.trim() && text.trim() !== currentText) {
      editor.chain().focus().extendMarkRange('link').deleteSelection().insertContent(
        `<a href="${href}">${text.trim()}</a>`
      ).run();
    }

    setEditing(false);
    setVisible(false);
  };

  const handleRemove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setVisible(false);
    setEditing(false);
  };

  const handleOpen = () => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setEditing(false);
      setVisible(false);
    }
  };

  if (!visible || !mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        transform: 'translateX(-50%)',
        zIndex: 99990,
      }}
      className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-lg)] overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100 w-[min(320px,calc(100vw-24px))] backdrop-blur-none"
    >
      {editing ? (
        /* ── Edit Mode ── */
        <div className="p-3 space-y-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
              {t('enlace_texto')}
            </label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('enlace_texto_placeholder')}
              className="h-8 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]/30"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
              URL
            </label>
            <input
              ref={urlInputRef}
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://..."
              className="h-8 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]/30"
            />
          </div>
          <div className="flex items-center justify-end gap-1 pt-1">
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setEditing(false); }}
              className="flex items-center justify-center size-7 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
              aria-label={t('cancelar')}
            >
              <X className="size-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSave(); }}
              className="flex items-center justify-center size-7 rounded-[var(--radius-sm)] bg-[var(--color-brand-gold)] text-white hover:opacity-90"
              aria-label={t('enlace_guardar')}
            >
              <Check className="size-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* ── View Mode ── */
        <div className="flex items-center gap-1 px-2 py-1.5">
          <span className="flex-1 min-w-0 truncate text-sm text-[var(--color-brand-gold)] px-1">
            {url}
          </span>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleEdit(); }}
            className="flex items-center justify-center size-7 shrink-0 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
            aria-label={t('enlace_editar')}
            title={t('enlace_editar')}
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); handleOpen(); }}
            className="flex items-center justify-center size-7 shrink-0 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
            aria-label={t('enlace_abrir_externo')}
            title={t('enlace_abrir_externo')}
          >
            <ExternalLink className="size-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); handleRemove(); }}
            className="flex items-center justify-center size-7 shrink-0 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-red-50 hover:text-[var(--color-error)] dark:hover:bg-red-950/20"
            aria-label={t('enlace_eliminar')}
            title={t('enlace_eliminar')}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
