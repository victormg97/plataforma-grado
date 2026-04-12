'use client';

import { useState, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/common/Button';
import { AppLogo } from '@/components/common/AppLogo';
import { Eye, EyeOff, CheckCircle2, AlertCircle, LinkIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SetupPasswordPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const t = useTranslations('setup');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [invalidCode, setInvalidCode] = useState(false);

  const [checkingCode, setCheckingCode] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        const res = await fetch(`/api/auth/setup?code=${resolvedParams.code}`);
        const data = await res.json();
        if (!res.ok || data.used) {
          setInvalidCode(true);
          return;
        }
        setEmail(data.email);
      } catch {
        setInvalidCode(true);
      } finally {
        setCheckingCode(false);
      }
    };
    fetchInvite();
  }, [resolvedParams.code]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (password.length < 6) {
      setFormError(t('error_min_chars'));
      return;
    }
    if (password !== confirmPassword) {
      setFormError(t('no_coinciden'));
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: resolvedParams.code, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al establecer la contraseña');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
      
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError('Ocurrió un error inesperado');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingCode) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-current border-t-transparent text-[var(--color-brand-gold)]" />
        <p className="text-[var(--color-text-secondary)]">{t('validando')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full">
      <div className="mb-8 text-center pt-8">
        <AppLogo variant="login" className="mx-auto" />
      </div>

      <div className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-[var(--space-lg)] shadow-[var(--shadow-md)]">
        <AnimatePresence mode="wait">
          {/* ── Estado: código inválido/expirado ── */}
          {invalidCode ? (
            <motion.div
              key="invalid"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-6"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-error)]/10">
                <LinkIcon className="h-8 w-8 text-[var(--color-error)]" />
              </div>
              <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-3">
                {t('error_invalido_titulo')}
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] mb-6 max-w-sm mx-auto">
                {t('error_invalido_desc')}
              </p>
              <Button fullWidth onClick={() => router.push('/login')}>
                {t('error_invalido_boton')}
              </Button>
            </motion.div>

          ) : success ? (
            /* ── Estado: éxito ── */
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-6"
            >
              <CheckCircle2 className="mx-auto h-16 w-16 text-[var(--color-success)] mb-4" />
              <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">{t('exito_titulo')}</h3>
              <p className="text-[var(--color-text-secondary)] mb-6">{t('exito_desc')}</p>
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent text-[var(--color-brand-gold)] mx-auto" />
            </motion.div>

          ) : (
            /* ── Estado: formulario ── */
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h2
                className="mb-2 text-center text-xl font-semibold text-[var(--color-text-primary)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {t('titulo')}
              </h2>
              {email && (
                <div className="flex justify-center mb-6">
                  <p className="text-sm text-[var(--color-text-secondary)] bg-[var(--color-bg-secondary)] px-3 py-1.5 rounded-full">
                    {email}
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {formError && (
                  <div className="rounded-[var(--radius-md)] bg-[var(--color-error)]/10 p-4 border border-[var(--color-error)]/20 animate-in fade-in zoom-in duration-300">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <AlertCircle className="h-5 w-5 text-[var(--color-error)]" aria-hidden="true" />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-[var(--color-error)]">{formError}</h3>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-[var(--color-text-secondary)]">
                      {t('nueva_password')}
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-11 pr-11"
                        placeholder={t('placeholder_password')}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? t('ocultar_password') : t('mostrar_password')}
                        className="absolute right-2 top-1/2 z-10 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)]"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="text-[var(--color-text-secondary)]">
                      {t('confirmar_password')}
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        name="confirm-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="h-11 pr-11"
                        placeholder={t('placeholder_password')}
                      />
                    </div>
                    {password && confirmPassword && password !== confirmPassword && (
                      <p className="text-xs text-[var(--color-error)] font-medium">{t('no_coinciden')}</p>
                    )}
                  </div>
                </div>

                <div className="pt-4">
                  <Button
                    type="submit"
                    fullWidth
                    loading={isLoading}
                    disabled={isLoading || !password || !confirmPassword || password !== confirmPassword}
                  >
                    {t('boton')}
                  </Button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
