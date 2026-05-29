'use client';

import { useState, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/common/Button';
import { AppLogo } from '@/components/common/AppLogo';
import { Eye, EyeOff, CheckCircle2, AlertCircle, LinkIcon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ── Modal de Términos y Condiciones ──────────────────────────────────────────

function TerminosModal({
  open,
  onClose,
  content,
  title,
}: {
  open: boolean;
  onClose: () => void;
  content: string;
  title: string;
}) {
  // Cerrar con Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Bloquear scroll del body mientras el modal está abierto
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="fixed inset-x-4 bottom-0 top-[5vh] z-50 mx-auto flex max-w-lg flex-col rounded-t-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:rounded-[var(--radius-lg)] sm:top-[5vh] sm:bottom-[5vh] sm:w-full"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4 shrink-0">
              <h2
                className="text-base font-semibold text-[var(--color-text-primary)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Contenido scrollable */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2" style={{ fontFamily: 'var(--font-display)' }}>{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-base font-semibold text-[var(--color-text-primary)] mt-6 mb-2" style={{ fontFamily: 'var(--font-display)' }}>{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mt-4 mb-1">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-3">{children}</p>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-[var(--color-text-primary)]">{children}</strong>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside space-y-1 mb-3 text-sm text-[var(--color-text-secondary)]">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside space-y-1 mb-3 text-sm text-[var(--color-text-secondary)]">{children}</ol>
                  ),
                  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--color-brand-gold)] underline underline-offset-2 hover:opacity-80 transition-opacity">{children}</a>
                  ),
                  hr: () => <hr className="border-[var(--color-border)] my-4" />,
                  table: ({ children }) => (
                    <div className="overflow-x-auto mb-3">
                      <table className="w-full text-sm border-collapse">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => <thead className="bg-[var(--color-bg-secondary)]">{children}</thead>,
                  th: ({ children }) => <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-primary)] border border-[var(--color-border)]">{children}</th>,
                  td: ({ children }) => <td className="px-3 py-2 text-[var(--color-text-secondary)] border border-[var(--color-border)]">{children}</td>,
                }}
              >
                {content}
              </ReactMarkdown>
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-[var(--color-border)] px-5 py-3">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-[var(--radius-sm)] bg-[var(--color-brand-gold)] py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────

export default function SetupPasswordPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const t = useTranslations('setup');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showTerminos, setShowTerminos] = useState(false);
  const [terminosContent, setTerminosContent] = useState('');

  const { data: inviteData, isLoading: checkingCode } = useQuery({
    queryKey: ['setup-invite', resolvedParams.code],
    queryFn: async () => {
      const res = await fetch(`/api/auth/setup?code=${resolvedParams.code}`);
      const data = await res.json();
      if (!res.ok || data.used) {
        return { valid: false, email: null };
      }
      return { valid: true, email: data.email as string };
    },
    staleTime: Infinity,
    retry: false,
  });

  // Precarga el contenido de T&C en background una vez que la página carga
  useEffect(() => {
    fetch('/api/legal/terminos')
      .then((r) => r.json())
      .then((d) => { if (d.content) setTerminosContent(d.content); })
      .catch(() => {/* silencioso — fallback al link externo */});
  }, []);

  const invalidCode = inviteData ? !inviteData.valid : false;
  const email = inviteData?.email ?? null;

  const handleOpenTerminos = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (terminosContent) {
      setShowTerminos(true);
    } else {
      // Fallback: abrir en nueva pestaña si el contenido no cargó
      window.open('/terminos', '_blank', 'noopener,noreferrer');
    }
  };

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
    if (!acceptedTerms) {
      setFormError(t('terminos_requerido'));
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
        <div className="size-8 animate-spin rounded-full border-4 border-current border-t-transparent text-[var(--color-brand-gold)]" />
        <p className="text-[var(--color-text-secondary)]">{t('validando')}</p>
      </div>
    );
  }

  return (
    <>
      {/* Modal de T&C — fuera del flujo del formulario */}
      <TerminosModal
        open={showTerminos}
        onClose={() => setShowTerminos(false)}
        content={terminosContent}
        title={t('terminos_link')}
      />

      {/*
        Layout: ocupa toda la altura disponible con flex column.
        El logo se encoge con max-h relativo al viewport para que nunca
        empuje el formulario fuera de pantalla.
      */}
      <div className="flex w-full flex-col items-center gap-4 py-4">
        {/* Logo — se encoge dinámicamente según el espacio disponible */}
        <div className="flex shrink-0 items-center justify-center" style={{ maxHeight: 'clamp(60px, 18vh, 160px)' }}>
          <AppLogo
            variant="login"
            className="mx-auto"
            style={{ maxHeight: 'clamp(60px, 18vh, 160px)' }}
          />
        </div>

        {/* Card del formulario */}
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
                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-[var(--color-error)]/10">
                  <LinkIcon className="size-8 text-[var(--color-error)]" />
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
                <CheckCircle2 className="mx-auto size-16 text-[var(--color-success)] mb-4" />
                <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">{t('exito_titulo')}</h3>
                <p className="text-[var(--color-text-secondary)] mb-6">{t('exito_desc')}</p>
                <div className="size-6 animate-spin rounded-full border-2 border-current border-t-transparent text-[var(--color-brand-gold)] mx-auto" />
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
                          <AlertCircle className="size-5 text-[var(--color-error)]" aria-hidden="true" />
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
                          className="absolute right-2 top-1/2 z-10 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)]"
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
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

                  {/* ── Checkbox de Términos y Condiciones ── */}
                  <div className="pt-2">
                    <label
                      htmlFor="accept-terms"
                      className={`flex items-start gap-3 cursor-pointer rounded-[var(--radius-md)] border p-3 transition-colors ${
                        acceptedTerms
                          ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)]'
                          : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50 hover:border-[var(--color-brand-gold)]/50'
                      }`}
                    >
                      <input
                        id="accept-terms"
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(e) => {
                          setAcceptedTerms(e.target.checked);
                          if (formError === t('terminos_requerido')) setFormError(null);
                        }}
                        className="mt-0.5 size-4 shrink-0 rounded border-[var(--color-border)] accent-[var(--color-brand-gold)] cursor-pointer"
                      />
                      <span className="text-sm text-[var(--color-text-secondary)] leading-snug">
                        {t('terminos_label')}{' '}
                        <button
                          type="button"
                          onClick={handleOpenTerminos}
                          className="font-medium text-[var(--color-brand-gold)] underline underline-offset-2 hover:opacity-80 transition-opacity"
                        >
                          {t('terminos_link')}
                        </button>
                      </span>
                    </label>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      fullWidth
                      loading={isLoading}
                      disabled={
                        isLoading ||
                        !password ||
                        !confirmPassword ||
                        password !== confirmPassword ||
                        !acceptedTerms
                      }
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
    </>
  );
}
