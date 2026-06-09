'use client';

import { useTranslations } from 'next-intl';
import { BookOpen, Mic } from 'lucide-react';
import { Reveal } from '../../shared/Reveal';

/**
 * Sección "Nuestros programas" — dos tarjetas (Híbrido / Intensivo)
 * sobre fondo secundario, con íconos circulares en burdeo.
 */
export function Programas() {
  const t = useTranslations('landing-pregunta-estrategica.programas');

  const programas = [
    { key: 'hibrido', Icon: BookOpen },
    { key: 'intensivo', Icon: Mic },
  ] as const;

  return (
    <section id="programas" className="scroll-mt-20 bg-[var(--color-bg)]">
      <div className="container-landing landing-section">
        <Reveal className="text-center">
          <h2
            className="text-[clamp(1.25rem,3vw,1.75rem)] font-bold tracking-wide text-[var(--color-brand-gold)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t('tituloPrincipal')}
          </h2>
          <p
            className="mt-1 text-[clamp(1.1rem,2.5vw,1.5rem)] text-[var(--color-text-primary)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t('subtitulo')}
          </p>
        </Reveal>

        <div className="mx-auto mt-12 grid max-w-4xl gap-8 md:grid-cols-2 md:gap-10">
          {programas.map(({ key, Icon }, i) => (
            <Reveal key={key} delay={i * 0.12} direction="up">
              <article className="relative flex h-full flex-col items-center rounded-[var(--radius-xl)] bg-[var(--color-card)] px-6 pb-8 pt-14 text-center shadow-[var(--shadow-md)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lg)]">
                {/* Ícono circular flotante */}
                <span
                  className="absolute -top-7 flex size-14 items-center justify-center rounded-full text-white shadow-[var(--shadow-md)]"
                  style={{ backgroundColor: 'var(--color-brand-gold)' }}
                >
                  <Icon className="size-7" />
                </span>

                <h3
                  className="text-xl font-bold tracking-wide text-[var(--color-text-primary)] md:text-2xl"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {t(`${key}.nombre`)}
                </h3>

                <p className="mt-3 text-lg font-bold text-[var(--color-text-primary)]">
                  {t(`${key}.modalidad`)}
                </p>

                <span className="my-4 h-0.5 w-16 bg-[var(--color-brand-gold)]" aria-hidden />

                <p className="text-[var(--color-text-secondary)]">
                  {t(`${key}.descripcion`)}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
