'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Check, Copy, Share2 } from 'lucide-react';
import { useTenant } from '@/config/client';
import { formatCLP, type ReferralProgramBenefits } from '@/lib/referidos/programBenefits';

interface CodigoPersonalProps {
  /** Código personal del usuario, o null si aún no se ha generado. */
  code: string | null;
  benefits: ReferralProgramBenefits;
}

/**
 * Tarjeta del código personal: muestra el código, permite copiarlo y
 * compartirlo con un mensaje listo para enviar.
 */
export function CodigoPersonal({ code, benefits }: CodigoPersonalProps) {
  const t = useTranslations('referidos-pregunta-estrategica');
  const tenant = useTenant();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const flashCopied = () => {
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      flashCopied();
    } catch {
      // El navegador puede bloquear el portapapeles; se ignora silenciosamente.
    }
  };

  const handleShare = async () => {
    if (!code) return;

    const text = t('codigo.compartirTexto', {
      app: tenant.nombre,
      codigo: code,
      monto: formatCLP(benefits.referredAmount),
    });

    if (navigator.share) {
      try {
        await navigator.share({ title: t('titulo'), text });
        return;
      } catch {
        // Cancelado o no permitido → se cae al portapapeles.
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      flashCopied();
    } catch {
      handleCopy();
    }
  };

  return (
    <article className="flex h-full flex-col rounded-[var(--radius-xl)] border border-[var(--color-brand-gold)]/25 bg-[var(--color-card,var(--color-bg))] p-[var(--space-lg)] text-center shadow-[var(--shadow-sm)]">
      <h2
        className="text-[clamp(1rem,2.4vw,1.35rem)] font-bold uppercase tracking-[0.12em] text-[var(--color-brand-gold)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {t('codigo.titulo')}
      </h2>
      <p className="mt-1 text-xs text-[var(--color-text-secondary)] sm:text-sm">
        {t('codigo.subtitulo')}
      </p>

      {code ? (
        <div className="mt-[var(--space-lg)] flex flex-col gap-[var(--space-sm)]">
          <div className="grid gap-[var(--space-sm)] sm:grid-cols-2">
            <div className="flex h-12 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-brand-gold)]/40 bg-[var(--color-bg)] px-4 font-mono text-lg font-bold tracking-[0.18em] text-[var(--color-brand-gold)] sm:text-xl">
              {code}
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="relative flex h-12 items-center justify-center gap-2 overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] text-sm font-bold uppercase tracking-widest text-white transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)] focus-visible:ring-offset-2"
            >
              <AnimatePresence mode="wait" initial={false}>
                <m.span
                  key={copied ? 'copied' : 'copy'}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-2"
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copied ? t('codigo.copiado') : t('codigo.copiar')}
                </m.span>
              </AnimatePresence>
            </button>
          </div>

          <button
            type="button"
            onClick={handleShare}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] text-sm font-bold uppercase tracking-widest text-white transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)] focus-visible:ring-offset-2"
          >
            <Share2 className="size-4" />
            {t('codigo.compartir')}
          </button>
        </div>
      ) : (
        <p className="mt-[var(--space-lg)] rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] px-4 py-6 text-xs text-[var(--color-text-muted)] sm:text-sm">
          {t('codigo.sinCodigo')}
        </p>
      )}
    </article>
  );
}
