'use client';

import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { Reveal } from '../../shared/Reveal';
import { usePlanesConfig } from '@/lib/hooks/usePlanesConfig';
import { tenantConfig } from '@/config';

/**
 * Sección de planes / precios.
 *
 * Pricing data is fetched from the database (landing_planes_config table)
 * and hydrated at server-render time via React Query's HydrationBoundary.
 * Falls back to i18n static values if DB config is unavailable.
 */
export function Planes() {
  const t = useTranslations('landing-pregunta-estrategica.planes');
  const { config } = usePlanesConfig(tenantConfig.id);

  const incluyen = t.raw('incluyen') as string[];
  const modalidad = t.raw('modalidad') as string[];

  // Use dynamic config if available, fallback to i18n
  const plan1 = {
    nombre: config?.plan1.nombre ?? t('plan1.nombre'),
    detalle: config?.plan1.detalle ?? t('plan1.detalle'),
    precio: config?.plan1.precio ?? t('plan1.precio'),
    precioAntes: config ? config.plan1.precioAntes : t('plan1.precioAntes'),
  };

  const plan2 = {
    nombre: config?.plan2.nombre ?? t('plan2.nombre'),
    detalle: config?.plan2.detalle ?? t('plan2.detalle'),
    precio: config?.plan2.precio ?? t('plan2.precio'),
    precioAntes: config ? config.plan2.precioAntes : t('plan2.precioAntes'),
  };

  const tutoria1 = {
    nombre: config?.tutoria1.nombre ?? t('tutoria1.nombre'),
    detalle: config?.tutoria1.detalle ?? t('tutoria1.detalle'),
    precio: config?.tutoria1.precio ?? t('tutoria1.precio'),
  };

  const tutoria2 = {
    nombre: config?.tutoria2.nombre ?? t('tutoria2.nombre'),
    detalle: config?.tutoria2.detalle ?? t('tutoria2.detalle'),
    precio: config?.tutoria2.precio ?? t('tutoria2.precio'),
  };

  const lectorPrecio = config?.lectorPrecio ?? t('lectorPrecio');

  // Offer text: from DB config or fallback to i18n
  const ofertaTexto = config
    ? (config.ofertaActiva ? config.ofertaTexto : null)
    : t('oferta');

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
              {ofertaTexto && (
                <p
                  className="mt-1 text-[clamp(1.6rem,4vw,2.75rem)] text-[var(--color-brand-gold)]"
                  style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}
                >
                  {ofertaTexto}
                </p>
              )}
            </Reveal>

            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {[plan1, plan2].map((plan, i) => (
                <Reveal key={i} delay={i * 0.12} direction="up">
                  <article className="flex h-full flex-col items-center rounded-[var(--radius-xl)] bg-[var(--color-card)] p-7 text-center shadow-[var(--shadow-md)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lg)]">
                    <h3
                      className="text-2xl font-bold text-[var(--color-brand-gold)]"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {plan.nombre}
                    </h3>
                    <p className="mt-4 font-semibold text-[var(--color-text-primary)]">
                      {plan.detalle}
                    </p>

                    <div className="mt-6 w-full rounded-[var(--radius-lg)] bg-[var(--color-brand-gold-muted)] px-4 py-6">
                      <p className="text-3xl font-extrabold text-[var(--color-brand-gold)] md:text-4xl">
                        {plan.precio}
                      </p>
                      {plan.precioAntes && (
                        <p className="mt-1 text-sm text-[var(--color-text-muted)] line-through">
                          {plan.precioAntes}
                        </p>
                      )}
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
            {[tutoria1, tutoria2].map((tut, i) => (
              <Reveal key={i} delay={i * 0.12} direction="up">
                <article className="flex flex-col items-center rounded-[var(--radius-xl)] bg-[var(--color-card)] p-8 text-center shadow-[var(--shadow-md)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lg)]">
                  <h4
                    className="text-xl font-bold tracking-wide text-[var(--color-text-primary)] md:text-2xl"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {tut.nombre}
                  </h4>
                  <p className="mt-2 text-[var(--color-text-secondary)]">
                    {tut.detalle}
                  </p>

                  <div className="mt-5 w-full rounded-[var(--radius-lg)] bg-[var(--color-brand-gold-muted)] px-4 py-5">
                    <p className="text-3xl font-extrabold text-[var(--color-brand-gold)] md:text-4xl">
                      {tut.precio}
                    </p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>

        {/* ── Programa Lector — precio ── */}
        <div className="mx-auto mt-20 w-full max-w-5xl">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
            {/* Columna izquierda: título + incluye */}
            <Reveal>
              <p
                className="text-[clamp(1.1rem,2.2vw,1.6rem)] font-bold uppercase tracking-[0.15em] text-[var(--color-brand-gold)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {t('lectorTitulo')}
              </p>
              <h3
                className="text-[clamp(3rem,8vw,5rem)] font-bold uppercase leading-[0.85] tracking-tight text-[var(--color-text-primary)]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {t('lectorNombre')}
              </h3>

              <p className="mt-8 text-[clamp(1.1rem,1.6vw,1.3rem)] font-semibold text-[var(--color-text-primary)]">
                {t('lectorIncluyeTitulo')}
              </p>
              <ul className="mt-4 space-y-3">
                {(t.raw('lectorIncluye') as string[]).map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[clamp(1rem,1.4vw,1.15rem)] text-[var(--color-text-primary)]">
                    <span
                      className="mt-1.5 size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: 'var(--color-brand-gold)' }}
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Reveal>

            {/* Columna derecha: tarjeta de precio */}
            <Reveal direction="left" delay={0.12}>
              <article className="flex flex-col items-center rounded-[var(--radius-xl)] bg-[var(--color-card)] p-8 text-center shadow-[var(--shadow-lg)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-xl)]">
                <div className="w-full rounded-[var(--radius-lg)] bg-[var(--color-brand-gold-muted)] px-6 py-7">
                  <p className="text-3xl font-extrabold text-[var(--color-brand-gold)] md:text-4xl">
                    {lectorPrecio}
                  </p>
                </div>
              </article>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
