'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { LanguageSelector } from '@/components/common/LanguageSelector';
import { Button } from '@/components/common/Button';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TabSeguridadProps {
  currentLocale: string;
  onSavePassword: (password: string) => Promise<void>;
  saving: boolean;
}

// ─── Shared input class ───────────────────────────────────────────────────────

const inputCls = cn(
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)]',
  'bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]',
  'placeholder:text-[var(--color-text-muted)]',
  'focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]',
  'transition-colors',
);

// ─── Component ────────────────────────────────────────────────────────────────

export function TabSeguridad({ currentLocale, onSavePassword, saving }: TabSeguridadProps) {
  const t = useTranslations('perfil');
  const tc = useTranslations('common');

  const [nuevaPass, setNuevaPass] = useState('');
  const [confirmaPass, setConfirmaPass] = useState('');
  const [showNueva, setShowNueva] = useState(false);
  const [showConfirma, setShowConfirma] = useState(false);

  async function handleSave() {
    await onSavePassword(nuevaPass);
    // Reset fields on success (parent will close modal)
    setNuevaPass('');
    setConfirmaPass('');
  }

  const passwordTooShort = nuevaPass.length > 0 && nuevaPass.length < 8;
  const passwordMismatch = nuevaPass.length >= 8 && confirmaPass.length > 0 && nuevaPass !== confirmaPass;

  return (
    <>
      {/* Idioma */}
      <LanguageSelector
        currentLocale={currentLocale}
        onLocaleChange={async (locale) => {
          // Persist language preference to DB
          await fetch('/api/perfil', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idioma: locale }),
          });
        }}
      />

      {/* Nueva contraseña */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-[var(--color-text-primary)]">
          {t('nueva_password')}
        </label>
        <div className="relative">
          <input
            type={showNueva ? 'text' : 'password'}
            value={nuevaPass}
            onChange={(e) => setNuevaPass(e.target.value)}
            placeholder={t('password_min')}
            autoComplete="new-password"
            className={cn(inputCls, 'pr-10')}
          />
          <button
            type="button"
            onClick={() => setShowNueva((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            aria-label={showNueva ? 'Ocultar' : 'Mostrar'}
          >
            {showNueva ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      {/* Confirmar contraseña */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-[var(--color-text-primary)]">
          {t('confirmar_password')}
        </label>
        <div className="relative">
          <input
            type={showConfirma ? 'text' : 'password'}
            value={confirmaPass}
            onChange={(e) => setConfirmaPass(e.target.value)}
            autoComplete="new-password"
            className={cn(inputCls, 'pr-10')}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          />
          <button
            type="button"
            onClick={() => setShowConfirma((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            aria-label={showConfirma ? 'Ocultar' : 'Mostrar'}
          >
            {showConfirma ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      {passwordTooShort && (
        <p className="text-xs text-[var(--color-error)]">
          {t('password_hint', { actual: nuevaPass.length })}
        </p>
      )}
      {passwordMismatch && (
        <p className="text-xs text-[var(--color-error)]">{t('password_no_coincide')}</p>
      )}

      <Button
        variant="primary"
        fullWidth
        loading={saving}
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? tc('cargando') : t('cambiar_password')}
      </Button>
    </>
  );
}
