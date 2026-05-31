'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { LinkIcon } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { BloqueGoogle } from '@/components/registro/BloqueGoogle';
import { FormularioRegistro } from '@/components/registro/FormularioRegistro';
import { useTenant } from '@/config/client';
import type { TipoRegistro } from '@/lib/validations/registro';

export default function RegistroPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const t = useTranslations('registro');
  const router = useRouter();
  const tenant = useTenant();
  const googleHabilitado = tenant.auth?.googleHabilitado === true;

  // Mostrar error del callback de Google si aplica (?error=google|invalido|usado)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err === 'google') toast.error(t('error_google'));
    else if (err === 'invalido') toast.error(t('error_google_invalido'));
    else if (err === 'usado') toast.error(t('error_enlace_no_disponible'));
  }, [t]);

  const { data, isLoading } = useQuery({
    queryKey: ['registro-validar', code],
    queryFn: async () => {
      const res = await fetch(`/api/registro/validar?code=${encodeURIComponent(code)}`);
      const body = await res.json();
      return body as { valid: boolean; tipo?: TipoRegistro };
    },
    staleTime: Infinity,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <div className="size-8 animate-spin rounded-full border-4 border-current border-t-transparent text-[var(--color-brand-gold)]" />
        <p className="text-[var(--color-text-secondary)]">{t('validando')}</p>
      </div>
    );
  }

  const invalido = !data?.valid;
  const tipo = (data?.tipo ?? 'alumno') as TipoRegistro;

  return (
    <div className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-[var(--space-lg)] shadow-[var(--shadow-md)]">
      <AnimatePresence mode="wait">
        {invalido ? (
          <motion.div
            key="invalid"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-6 text-center"
          >
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-[var(--color-error)]/10">
              <LinkIcon className="size-8 text-[var(--color-error)]" />
            </div>
            <h3 className="mb-3 text-xl font-bold text-[var(--color-text-primary)]">
              {t('invalido_titulo')}
            </h3>
            <p className="mx-auto mb-6 max-w-sm text-sm text-[var(--color-text-secondary)]">
              {t('invalido_desc')}
            </p>
            <Button fullWidth onClick={() => router.push('/login')}>
              {t('invalido_boton')}
            </Button>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h2
              className="mb-1 text-center text-xl font-semibold text-[var(--color-text-primary)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {tipo === 'profesor' ? t('titulo_profesor') : t('titulo_alumno')}
            </h2>
            <p className="mb-6 text-center text-sm text-[var(--color-text-muted)]">
              {t('subtitulo')}
            </p>

            {googleHabilitado && <BloqueGoogle code={code} />}

            <div className={googleHabilitado ? 'mt-4' : ''}>
              <FormularioRegistro code={code} tipo={tipo} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
