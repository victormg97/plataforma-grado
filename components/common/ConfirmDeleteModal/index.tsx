'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { m, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/common/Button';

interface ConfirmDeleteModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  entityName: string;          // e.g. "Pedro García"
  entityType?: string;         // e.g. "alumno" | "profesor"
  description?: string;        // Additional context shown under the name
}

export function ConfirmDeleteModal({
  open,
  onClose,
  onConfirm,
  entityName,
  entityType = 'registro',
  description,
}: ConfirmDeleteModalProps) {
  const t = useTranslations('confirm_delete');
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);

  const isMatch = inputValue.trim().toLowerCase() === entityName.trim().toLowerCase();

  const handleConfirm = async () => {
    if (!isMatch) return;
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
      setInputValue('');
    }
  };

  const handleClose = () => {
    if (loading) return;
    setInputValue('');
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <m.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />

          {/* Modal */}
          <m.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="presentation"
            onClick={handleClose}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md rounded-2xl border border-red-100 bg-[var(--color-bg)] shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="bg-red-50 dark:bg-red-950/30 p-6 border-b border-red-100 dark:border-red-900/30">
                <div className="flex items-start gap-4">
                  <div className="bg-red-100 dark:bg-red-900/50 size-12 rounded-full flex items-center justify-center shrink-0">
                    <AlertTriangle className="size-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                      {t('titulo', { tipo: entityType })}
                    </h2>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                      {t('irreversible')}
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    disabled={loading}
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors shrink-0 disabled:opacity-50"
                  >
                    <X className="size-5" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">
                <div className="bg-[var(--color-bg-secondary)] rounded-xl p-4 border border-[var(--color-border)]">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {t('descripcion', { nombre: entityName })}
                    {description && (
                      <span className="block mt-1 text-xs text-[var(--color-text-muted)]">
                        {description}
                      </span>
                    )}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-[var(--color-text-secondary)]">
                    {t('escribir_nombre')}{' '}
                    <span className="font-semibold text-[var(--color-text-primary)] select-all cursor-text">
                      {entityName}
                    </span>
                  </Label>
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={entityName}
                    autoComplete="off"
                    className={`h-11 transition-colors ${
                      inputValue && isMatch
                        ? 'border-red-400 focus-visible:ring-red-400'
                        : ''
                    }`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && isMatch && !loading) handleConfirm();
                    }}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={handleClose}
                    disabled={loading}
                  >
                    {t('cancelar')}
                  </Button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={!isMatch || loading}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-red-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {t('eliminando')}
                      </>
                    ) : (
                      t('confirmar')
                    )}
                  </button>
                </div>
              </div>
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
}
