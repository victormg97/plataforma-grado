'use client';

import { useState, useEffect } from 'react';
import { Folder, Save, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';

interface CarpetaModalProps {
  /** If provided, we're renaming; otherwise creating */
  initialNombre?: string;
  onClose: () => void;
  onSave: (nombre: string) => Promise<void>;
  saving: boolean;
}

export function CarpetaModal({ initialNombre, onClose, onSave, saving }: CarpetaModalProps) {
  const t = useTranslations('recursos');
  const [nombre, setNombre] = useState(initialNombre ?? '');
  const isEditing = !!initialNombre;

  useEffect(() => {
    setNombre(initialNombre ?? '');
  }, [initialNombre]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    await onSave(nombre.trim());
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEditing ? t('renombrar_carpeta') : t('nueva_carpeta')}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t('cancelar')}</Button>
          <Button
            onClick={handleSubmit as never}
            loading={saving}
            disabled={!nombre.trim()}
          >
            {isEditing ? (
              <><Save className="mr-1.5 size-4" />{t('guardar_cambios')}</>
            ) : (
              <><Folder className="mr-1.5 size-4" />{t('crear_carpeta')}</>
            )}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t('nombre_carpeta')}
          </label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={t('nombre_carpeta_placeholder')}
            autoFocus
            maxLength={80}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:ring-2 focus:ring-[var(--color-brand-gold-muted)]"
          />
        </div>
      </form>
    </Modal>
  );
}
