'use client';

import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { Reveal } from '../../shared/Reveal';

/**
 * Sección de planes / precios. Dos tarjetas de precio a la izquierda y
 * la lista de "incluye" + modalidad a la derecha, separadas por una línea.
 */
export function Planes() {
  const t = useTranslations('landing-pregunta-estrategica.planes');

  const incluyen = t.raw('incluyen') as string[];
  const modalidad = t.raw('modalidad') as string[];

  const planes = ['plan1', 'plan2'] as const;

  const tutorias = ['tutoria1', 'tutoria2'] as const;

  return (
    <section id="planes" className="scroll-mt-20 bg-[var(--color-bg)]">
      <div className="container-landing landing-section">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.5fr_auto_1fr] lg:gap-16">
          {/* ── Columna izquierda: título + tarjetas de precio ── */}
          <div>
            <Reveal>
              <h2
                className="text-[clamp(1.5rem,3.5vw,2.5rem)] font-bold uppercase tracking-wide text-[var(--color-text-primary)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {t('titulo')}
              </h2>
              <p
                className="mt-1 text-[clamp(1.6rem,4vw,2.75rem)] text-[var(--color-brand-gold)]"
                style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}
              >
                {t('oferta')}
              </p>
            </Reveal>

            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {planes.map((p, i) => (
                <Reveal key={p} delay={i * 0.12} direction="up">
                  <article className="flex h-full flex-col items-center rounded-[var(--radius-xl)] bg-[var(--color-card)] p-7 text-center shadow-[var(--shadow-md)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lg)]">
                    <h3
                      className="text-2xl font-bold text-[var(--color-brand-gold)]"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {t(`${p}.nombre`)}
                    </h3>
                    <p className="mt-4 font-semibold text-[var(--color-text-primary)]">
                      {t(`${p}.detalle`)}
                    </p>

                    <div className="mt-6 w-full rounded-[var(--radius-lg)] bg-[var(--color-brand-gold-muted)] px-4 py-6">
                      <p className="text-3xl font-extrabold text-[var(--color-brand-gold)] md:text-4xl">
                        {t(`${p}.precio`)}
                      </p>
                      <p className="mt-1 text-sm text-[var(--color-text-muted)] line-through">
                        {t(`${p}.precioAntes`)}
                      </p>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>

          {/* ── Separador vertical (solo desktop) ── */}
          <div className="hidden w-px self-stretch bg-[var(--color-border-strong)] lg:block" aria-hidden />

          {/* ── Columna derecha: incluye + modalidad ── */}
          <Reveal direction="left" delay={0.1}>
            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-bold text-[var(--color-brand-gold)] md:text-xl">
                  {t('incluyenTitulo')}
                </h3>
                <ul className="mt-4 space-y-3">
                  {incluyen.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[var(--color-text-secondary)]">
                      <Check className="mt-0.5 size-5 shrink-0 text-[var(--color-brand-gold)]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-bold text-[var(--color-brand-gold)] md:text-xl">
                  {t('modalidadTitulo')}
                </h3>
                <ul className="mt-4 space-y-3">
                  {modalidad.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 font-semibold text-[var(--color-text-primary)]">
                      <span
                        className="mt-1.5 size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: 'var(--color-brand-gold)' }}
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-sm font-medium italic text-[var(--color-text-secondary)]">
                {t('duracionSesion')}
              </p>
            </div>
          </Reveal>
        </div>

        {/* ── Valor tutoría online ── */}
        <div className="mx-auto mt-16 max-w-3xl">
          <Reveal>
            <h3
              className="text-center text-[clamp(1.25rem,2.5vw,1.75rem)] font-bold uppercase tracking-wider text-[var(--color-text-primary)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {t('tutoriasTitulo')}
            </h3>
          </Reveal>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 sm:gap-8">
            {tutorias.map((tut, i) => (
              <Reveal key={tut} delay={i * 0.12} direction="up">
                <article className="flex flex-col items-center rounded-[var(--radius-xl)] bg-[var(--color-card)] p-8 text-center shadow-[var(--shadow-md)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lg)]">
                  <h4
                    className="text-xl font-bold tracking-wide text-[var(--color-text-primary)] md:text-2xl"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {t(`${tut}.nombre`)}
                  </h4>
                  <p className="mt-2 text-[var(--color-text-secondary)]">
                    {t(`${tut}.detalle`)}
                  </p>

                  <div className="mt-5 w-full rounded-[var(--radius-lg)] bg-[var(--color-brand-gold-muted)] px-4 py-5">
                    <p className="text-3xl font-extrabold text-[var(--color-brand-gold)] md:text-4xl">
                      {t(`${tut}.precio`)}
                    </p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
