'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { m } from 'framer-motion';
import { AppLogo } from '@/components/common/AppLogo';
import { Reveal } from '../../shared/Reveal';
import { LogoReducido } from './LogoReducido';

const easeOut = [0.22, 1, 0.36, 1] as const;

interface SobreNosotrasProps {
  /** Ruta pública de la imagen, resuelta en el servidor. null = sin imagen */
  imageSrc: string | null;
}

export function SobreNosotras({ imageSrc }: SobreNosotrasProps) {
  const t = useTranslations('landing-pregunta-estrategica.sobreNosotras');
  const parrafos = t.raw('parrafos') as string[];
  const hasImage = imageSrc !== null;

  return (
    <section
      id="sobre-nosotras"
      className="scroll-mt-20 bg-[var(--color-section-alt)]"
    >
      <div className="container-landing landing-section">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          {/* ── Imagen ── */}
          <m.div
            className="flex w-full justify-center"
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, ease: easeOut }}
          >
            {hasImage ? (
              <Image
                src={imageSrc}
                alt={t('imagenAlt')}
                width={700}
                height={1100}
                sizes="(min-width: 1024px) 40vw, 90vw"
                className="h-auto max-h-[78vh] w-auto rounded-[var(--radius-xl)] object-contain shadow-[var(--shadow-lg)]"
              />
            ) : (
              <div className="flex aspect-[4/5] w-full max-w-sm items-center justify-center rounded-[var(--radius-xl)] bg-[var(--color-card)] p-8 shadow-[var(--shadow-lg)]">
                <AppLogo variant="login" className="max-w-[60%]" />
              </div>
            )}
          </m.div>

          {/* ── Texto ── */}
          <div className="relative flex flex-col justify-center px-6 py-8 md:px-10 md:py-10">
            {/* Marco decorativo de esquinas (líneas tipo bracket) */}
            <span
              aria-hidden
              className="pointer-events-none absolute right-0 top-0 h-24 w-24 border-r-2 border-t-2"
              style={{ borderColor: 'var(--color-text-primary)' }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-0 left-0 h-24 w-24 border-b-2 border-l-2"
              style={{ borderColor: 'var(--color-text-primary)' }}
            />

            {/* Encabezado: emblema + título */}
            <Reveal direction="left">
              <div className="mb-8 flex items-center gap-4">
                <LogoReducido className="size-16 shrink-0" />
                <h2
                  className="text-[clamp(1.75rem,4.5vw,3rem)] font-bold uppercase tracking-wide text-[var(--color-text-primary)]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {t('titulo')}
                </h2>
              </div>
            </Reveal>

            {/* Párrafos */}
            <div className="space-y-5 text-[clamp(1rem,1.4vw,1.15rem)] leading-relaxed text-[var(--color-text-secondary)]">
              {parrafos.map((parrafo, i) => (
                <Reveal key={i} direction="up" delay={0.1 + i * 0.08}>
                  <p>{parrafo}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
