'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type ModoCreacion = 'link' | 'default';

interface CredentialsSectionProps {
  useAppEmail: boolean;
  onUseAppEmailChange: (checked: boolean) => void;
  email: string;
  onEmailChange: (value: string) => void;
  telefono: string;
  onTelefonoChange: (value: string) => void;
  modoCreacion: ModoCreacion;
  onModoCreacionChange: (modo: ModoCreacion) => void;
  hideTitle?: boolean;
  emailDomain?: string;
}

export function CredentialsSection({
  useAppEmail,
  onUseAppEmailChange,
  email,
  onEmailChange,
  telefono,
  onTelefonoChange,
  modoCreacion,
  onModoCreacionChange,
  hideTitle = false,
  emailDomain,
}: CredentialsSectionProps) {
  const t = useTranslations('crear_usuario.alumno');

  return (
    <div className="space-y-4">
      {!hideTitle && (
        <h3 className="text-lg font-medium text-[var(--color-text-primary)] border-b pb-2 border-[var(--color-border)]">
          {t('contacto_acceso')}
        </h3>
      )}

      <div className="space-y-4 bg-[var(--color-bg-secondary)]/50 p-4 rounded-lg border border-[var(--color-border)]">
        <div className="flex items-center space-x-2 mb-2">
          <input
            type="checkbox"
            id="useAppEmail"
            checked={useAppEmail}
            onChange={(e) => onUseAppEmailChange(e.target.checked)}
            className="rounded border-[var(--color-border)] text-[var(--color-brand-gold)] focus:ring-[var(--color-brand-gold)] size-4"
          />
          <Label htmlFor="useAppEmail" className="font-medium cursor-pointer">
            {emailDomain
              ? t('generar_correo_dominio', { domain: emailDomain })
              : t('generar_correo')}
          </Label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">
              {useAppEmail ? t('correo') : t('correo_requerido')}
            </Label>
            <Input
              id="email"
              type="email"
              placeholder={useAppEmail ? t('correo_placeholder_auto') : t('correo_placeholder')}
              autoComplete="off"
              disabled={useAppEmail}
              value={useAppEmail ? '' : email}
              onChange={(e) => onEmailChange(e.target.value)}
              required={!useAppEmail}
              className={useAppEmail ? 'opacity-50' : ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefono">{t('telefono')}</Label>
            <Input
              id="telefono"
              placeholder={t('telefono_placeholder')}
              autoComplete="off"
              value={telefono}
              onChange={(e) => onTelefonoChange(e.target.value)}
            />
          </div>
        </div>

        <div className="pt-4 border-t border-[var(--color-border)] mt-4 space-y-3">
          <Label className="text-sm font-medium text-[var(--color-text-secondary)]">
            {t('modo_acceso')}
          </Label>
          <div className="flex bg-[var(--color-input,var(--color-bg))] border border-[var(--color-border)] rounded-lg overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => onModoCreacionChange('link')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                modoCreacion === 'link'
                  ? 'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)] border-b-2 border-[var(--color-brand-gold)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
              }`}
            >
              {t('modo_enlace')}
            </button>
            <button
              type="button"
              onClick={() => onModoCreacionChange('default')}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors border-l border-[var(--color-border)] ${
                modoCreacion === 'default'
                  ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-b-2 border-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
              }`}
            >
              {t('modo_password')}
            </button>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            {modoCreacion === 'link'
              ? t('modo_enlace_desc')
              : t('modo_password_desc', { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </div>
  );
}
