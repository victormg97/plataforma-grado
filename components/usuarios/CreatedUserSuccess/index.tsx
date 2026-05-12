'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { m } from 'framer-motion';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CreatedUserSuccessProps {
  email: string;
  password: string | null;
  setupCode: string | null;
  onBack: () => void;
  /** Translation namespace key for the success title */
  titleKey?: string;
}

export function CreatedUserSuccess({
  email,
  password,
  setupCode,
  onBack,
}: CreatedUserSuccessProps) {
  const t = useTranslations('crear_usuario.alumno');
  const tc = useTranslations('common');
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyLink = () => {
    if (setupCode) {
      const link = `${window.location.origin}/setup/${setupCode}`;
      navigator.clipboard.writeText(link);
      setCopiedLink(true);
      toast.success(tc('exito'));
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <m.div
      key="success"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.25 }}
      className="max-w-2xl mx-auto"
    >
      <Card className="p-8 text-center space-y-6 border-[var(--color-brand-gold)]/20 bg-[var(--color-brand-gold-muted)]">
        <div className="size-16 bg-[var(--color-brand-gold-muted)] rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="size-8 text-[var(--color-brand-gold)]" />
        </div>
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">{t('exito_titulo')}</h2>

        <div className="bg-[var(--color-bg)] p-6 rounded-xl border border-[var(--color-border)] shadow-sm text-left space-y-4">
          <div>
            <Label className="text-[var(--color-text-muted)]">{t('correo_label')}</Label>
            <p className="text-lg font-medium select-all text-[var(--color-text-primary)]">{email}</p>
          </div>

          {setupCode ? (
            <div>
              <Label className="text-[var(--color-text-muted)]">{t('enlace_label')}</Label>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/setup/${setupCode}`}
                  className="bg-[var(--color-bg-secondary)] flex-1 border-[var(--color-brand-gold)]/30"
                />
                <Button onClick={handleCopyLink} variant="secondary" className="border-[var(--color-brand-gold)]/30 hover:bg-[var(--color-brand-gold-muted)]">
                  {copiedLink ? <Check className="size-4 text-[var(--color-success)]" /> : <Copy className="size-4 text-[var(--color-brand-gold)]" />}
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Label className="text-[var(--color-text-muted)]">{t('password_label')}</Label>
              <p className="text-lg font-mono font-medium bg-[var(--color-bg-secondary)] p-3 rounded-lg select-all border text-center mt-2">
                {password}
              </p>
            </div>
          )}
        </div>

        <Button
          className="w-full mt-4 bg-[var(--color-brand-gold)] hover:opacity-90 text-white"
          size="lg"
          onClick={onBack}
        >
          {t('boton_volver_lista')}
        </Button>
      </Card>
    </m.div>
  );
}
