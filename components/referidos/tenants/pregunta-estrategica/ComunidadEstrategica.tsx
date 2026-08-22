'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useTenant } from '@/config/client';
import { Reveal } from '@/components/common/Reveal';
import { TerminosReferidosButton } from '@/components/referidos/TerminosReferidosModal';
import {
  countReferralsThisMonth,
  deriveProgramBenefits,
} from '@/lib/referidos/programBenefits';
import type { ReferidosViewProps } from '@/components/referidos/variants';
import { BeneficiosDuales } from './BeneficiosDuales';
import { ComoFunciona } from './ComoFunciona';
import { AcumulaDescuento } from './AcumulaDescuento';
import { CodigoPersonal } from './CodigoPersonal';
import { MisReferidos } from './MisReferidos';

/**
 * Vista del programa de referidos "Comunidad Estratégica" (tenant
 * pregunta-estrategica).
 *
 * Los montos, la duración y los niveles de acumulación se derivan de las reglas
 * de recompensa configuradas por el administrador (`referral_reward_rules`) y
 * caen a los valores por defecto del programa cuando aún no existen reglas.
 *
 * Respeta los flags de `referral_settings`:
 *   - `show_rewards_to_user`        → bloques de beneficios y acumulación
 *   - `show_referral_count_to_user` → progreso mensual y listado de referidos
 */
export default function ComunidadEstrategica({
  settings,
  code,
  usages,
  rules,
  userId,
}: ReferidosViewProps) {
  const t = useTranslations('referidos-pregunta-estrategica');
  const tenant = useTenant();

  const benefits = useMemo(() => deriveProgramBenefits(rules), [rules]);
  const referidosEsteMes = useMemo(
    () => countReferralsThisMonth(usages, userId),
    [usages, userId]
  );

  // Término del tenant para las sesiones ("interrogaciones", "pruebas", ...).
  const programa = tenant.terminoPrueba.plural.toLocaleLowerCase('es');
  const nombrePrograma = t('titulo');

  const showRewards = settings.show_rewards_to_user;
  const showCount = settings.show_referral_count_to_user;

  return (
    <div className="mx-auto max-w-5xl space-y-[var(--space-xl)] pb-[var(--space-lg)]">
      {/* ── Encabezado ── */}
      <Reveal direction="none">
        <header className="text-center">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-[var(--color-brand-gold)] sm:text-xs">
            {t('eyebrow')}
          </p>
          <h1
            className="mt-2 text-[clamp(1.75rem,6vw,3.25rem)] font-bold uppercase leading-[1.05] tracking-tight text-[var(--color-text-primary)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {nombrePrograma}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold text-[var(--color-text-primary)] sm:text-lg">
            {t('lema')}
          </p>
          <p className="mx-auto mt-2 max-w-2xl text-xs leading-relaxed text-[var(--color-text-secondary)] sm:text-base">
            {t('descripcion', { app: tenant.nombre })}
          </p>
        </header>
      </Reveal>

      {/* ── Doble beneficio ── */}
      {showRewards && <BeneficiosDuales benefits={benefits} programa={programa} />}

      {/* ── Cómo funciona ── */}
      <ComoFunciona benefits={benefits} programa={programa} />

      {/* ── Acumulación + código personal ── */}
      <div
        className={
          showRewards
            ? 'grid gap-[var(--space-md)] lg:grid-cols-2 lg:gap-[var(--space-lg)]'
            : 'mx-auto max-w-xl'
        }
      >
        {showRewards && (
          <Reveal direction="right">
            <AcumulaDescuento
              benefits={benefits}
              referidosEsteMes={referidosEsteMes}
              mostrarProgreso={showCount}
            />
          </Reveal>
        )}

        <Reveal direction={showRewards ? 'left' : 'up'} delay={showRewards ? 0.08 : 0}>
          <CodigoPersonal code={code} benefits={benefits} />
        </Reveal>
      </div>

      {/* ── Nota legal + botón (i) ── */}
      <Reveal direction="none">
        <div className="flex flex-wrap items-center justify-center gap-2 text-center">
          <p className="text-xs text-[var(--color-text-secondary)] sm:text-sm">
            {t('terminos.nota', { programa: nombrePrograma })}
          </p>
          <TerminosReferidosButton
            title={t('terminos.titulo', { programa: nombrePrograma })}
          />
        </div>
      </Reveal>

      {/* ── Mis referidos ── */}
      {showCount && (
        <Reveal>
          <MisReferidos usages={usages} showRewards={showRewards} />
        </Reveal>
      )}
    </div>
  );
}
