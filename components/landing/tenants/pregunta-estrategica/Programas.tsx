'use client';

import { useTranslations } from 'next-intl';
import { BookOpen, Mic, FileText, Briefcase, MousePointerClick, Lightbulb, FolderOpen } from 'lucide-react';
import { Reveal } from '../../shared/Reveal';

interface ProgramasProps {
  /** Ruta pública de la imagen del programa lector, resuelta en el servidor. null = sin imagen */
  lectorImageSrc: string | null;
}

/**
 * Sección "Nuestros programas" — dos tarjetas (Híbrido / Intensivo)
 * sobre fondo secundario, con íconos circulares en burdeo.
 * Incluye sub-sección "Nos adaptamos a la modalidad de tu Examen de grado".
 * Incluye sub-sección "Programa Lector" al final (ocupa un viewport).
 */
export function Programas({ lectorImageSrc }: ProgramasProps) {
  const t = useTranslations('landing-pregunta-estrategica.programas');
  const hasLectorImage = lectorImageSrc !== null;

  const programas = [
    { key: 'hibrido', Icon: BookOpen },
    { key: 'intensivo', Icon: Mic },
  ] as const;

  const modalidades = [
    { key: 'cedula', Icon: FileText },
    { key: 'casos', Icon: Briefcase },
  ] as const;

  const lectorBeneficios = [
    { key: 'material', Icon: BookOpen },
    { key: 'apuntes', Icon: Lightbulb },
    { key: 'recursos', Icon: FolderOpen },
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

        {/* ── Sub-sección: Nos adaptamos a la modalidad ── */}
        <div className="mt-20">
          <Reveal className="text-center">
            <h3
              className="text-[clamp(1.25rem,3vw,1.75rem)] font-bold tracking-wide text-[var(--color-brand-gold)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {t('modalidadesTitulo')}
            </h3>
            <p
              className="mt-1 text-[clamp(1.1rem,2.5vw,1.5rem)] italic text-[var(--color-text-primary)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {t('modalidadesSubtitulo')}
            </p>
          </Reveal>

          <div className="mx-auto mt-12 grid max-w-4xl gap-8 md:grid-cols-2 md:gap-10">
            {modalidades.map(({ key, Icon }, i) => (
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

                  <span className="my-4 h-0.5 w-16 bg-[var(--color-brand-gold)]" aria-hidden />

                  <p className="text-[var(--color-text-secondary)]">
                    {t(`${key}.descripcion`)}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          PROGRAMA LECTOR — ocupa su propio viewport
          ══════════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden">
        {/* ── Imagen anclada a la derecha — siempre visible, se achica responsive ── */}
        {hasLectorImage && (
          <div className="absolute inset-y-0 right-0 w-[15%] sm:w-[20%] md:w-[25%] lg:w-[32%] xl:w-[30%]" aria-hidden>
            <div
              className="absolute inset-0 bg-cover bg-right"
              style={{ backgroundImage: `url("${lectorImageSrc}")` }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-bg)] from-15% via-[var(--color-bg)]/80 via-40% to-[var(--color-bg)]/20" />
            {/* Degradado superior para suavizar la aparición de la imagen */}
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[var(--color-bg)] to-transparent" />
          </div>
        )}

        <div className="container-landing relative z-10 py-10 lg:flex lg:min-h-[calc(100svh-5rem)] lg:flex-col lg:justify-center lg:py-14">
          <div className={hasLectorImage ? 'pr-[14%] sm:pr-[18%] md:pr-[23%] lg:pr-[30%] xl:pr-[28%]' : ''}>
            <div className="grid w-full items-center gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-14">
              {/* ── Columna izquierda: título + descripción + beneficios ── */}
              <div>
                <Reveal>
                  <p
                    className="text-[clamp(1.1rem,2vw,1.5rem)] font-bold uppercase tracking-[0.15em] text-[var(--color-brand-gold)]"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {t('lector.titulo')}
                  </p>
                  <h3
                    className="text-[clamp(2.5rem,7vw,4.5rem)] font-bold uppercase leading-[0.9] tracking-tight text-[var(--color-text-primary)]"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {t('lector.nombre')}
                  </h3>

                  {/* Línea decorativa */}
                  <div className="mt-4 flex items-center gap-2" aria-hidden>
                    <span className="size-2.5 shrink-0 rounded-full bg-[var(--color-text-primary)]" />
                    <span className="h-0.5 w-full max-w-[200px] bg-[var(--color-text-primary)]" />
                    <span className="size-2.5 shrink-0 rounded-full bg-[var(--color-text-primary)]" />
                  </div>
                </Reveal>

                <Reveal delay={0.1}>
                  <p className="mt-6 max-w-md text-[clamp(1rem,1.5vw,1.2rem)] leading-relaxed text-[var(--color-text-primary)]">
                    {t('lector.descripcion')}
                  </p>
                </Reveal>

                {/* Beneficios */}
                <div className="mt-8 space-y-5">
                  {lectorBeneficios.map(({ key, Icon }, i) => (
                    <Reveal key={key} delay={0.15 + i * 0.08} direction="up">
                      <div className="flex items-center gap-4">
                        <span
                          className="flex size-11 shrink-0 items-center justify-center rounded-full text-white shadow-[var(--shadow-md)]"
                          style={{ backgroundColor: 'var(--color-brand-gold)' }}
                        >
                          <Icon className="size-5" />
                        </span>
                        <p className="text-[clamp(0.95rem,1.3vw,1.1rem)] leading-snug text-[var(--color-text-primary)]">
                          {t(`lector.beneficios.${key}`)}
                        </p>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </div>

              {/* ── Columna derecha: tarjeta CTA ── */}
              <div className="flex flex-col items-center gap-8">
                <Reveal direction="left" delay={0.1}>
                  <div className="w-full max-w-md rounded-[var(--radius-xl)] bg-[var(--color-card)] p-8 shadow-[var(--shadow-lg)]">
                    <p className="text-center text-[clamp(1rem,1.5vw,1.2rem)] leading-relaxed text-[var(--color-text-primary)]">
                      {t('lector.acceso')}
                    </p>
                    <div className="mt-5 flex justify-center">
                      <MousePointerClick
                        className="size-10 text-[var(--color-text-muted)]"
                        strokeWidth={1.5}
                      />
                    </div>
                  </div>
                </Reveal>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
