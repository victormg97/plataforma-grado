'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { m } from 'framer-motion';
import { Reveal } from '../../shared/Reveal';
import { LogoReducido } from './LogoReducido';
import { useSobreNosotrasConfig } from '@/lib/hooks/useSobreNosotrasConfig';
import { tenantConfig } from '@/config';

const easeOut = [0.22, 1, 0.36, 1] as const;

interface SobreNosotrasProps {
  /** Fallback image path from static files (used when no DB images are configured) */
  imageSrc: string | null;
}

/**
 * Card component for each persona's image with name overlay.
 */
function PersonaImageCard({
  imageUrl,
  prefijo,
  nombre,
  alt,
  delay = 0,
}: {
  imageUrl: string;
  prefijo: string;
  nombre: string;
  alt: string;
  delay?: number;
}) {
  return (
    <Reveal direction="up" delay={delay} className="lg:flex-1 lg:min-h-0">
      <div className="relative aspect-[4/3] lg:aspect-auto lg:h-full overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-lg)]">
        <Image
          src={imageUrl}
          alt={alt}
          fill
          sizes="(min-width: 1024px) 35vw, 80vw"
          className="object-cover"
          unoptimized
        />
        {/* Name overlay at the bottom */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-4 pb-4 pt-10 sm:px-6 sm:pb-5 sm:pt-14">
          <p className="text-sm font-medium uppercase tracking-wider text-white/80 sm:text-base">
            {prefijo}
          </p>
          <p
            className="text-lg font-bold text-white sm:text-xl md:text-2xl"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {nombre}
          </p>
        </div>
      </div>
    </Reveal>
  );
}

export function SobreNosotras({ imageSrc }: SobreNosotrasProps) {
  const t = useTranslations('landing-pregunta-estrategica.sobreNosotras');
  const parrafos = t.raw('parrafos') as string[];
  const { config } = useSobreNosotrasConfig(tenantConfig.id);

  // Determine if we use the new two-image layout or fallback to single static image
  const hasDynamicImages = config?.persona1.imageUrl && config?.persona2.imageUrl;

  return (
    <section
      id="sobre-nosotras"
      className="scroll-mt-20 bg-[var(--color-section-alt)]"
    >
      <div className="container-landing landing-section">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          {/* ── Imágenes ── */}
          <m.div
            className="flex w-full justify-center"
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, ease: easeOut }}
          >
            {hasDynamicImages ? (
              /* Two separate images stacked vertically with name overlays.
                 Container is height-constrained so both fit within one viewport. */
              <div className="flex w-full max-w-md flex-col gap-3 lg:max-h-[calc(100svh-10rem)]">
                <PersonaImageCard
                  imageUrl={config.persona1.imageUrl!}
                  prefijo={config.persona1.prefijo}
                  nombre={config.persona1.nombre}
                  alt={`${config.persona1.prefijo} ${config.persona1.nombre}`}
                  delay={0}
                />
                <PersonaImageCard
                  imageUrl={config.persona2.imageUrl!}
                  prefijo={config.persona2.prefijo}
                  nombre={config.persona2.nombre}
                  alt={`${config.persona2.prefijo} ${config.persona2.nombre}`}
                  delay={0.12}
                />
              </div>
            ) : imageSrc ? (
              /* Fallback: single static image (current behavior) */
              <Image
                src={imageSrc}
                alt={t('imagenAlt')}
                width={700}
                height={1100}
                sizes="(min-width: 1024px) 40vw, 90vw"
                className="h-auto max-h-[78vh] w-auto rounded-[var(--radius-xl)] object-contain shadow-[var(--shadow-lg)]"
              />
            ) : (
              /* No image at all */
              <div className="flex aspect-[4/5] w-full max-w-sm items-center justify-center rounded-[var(--radius-xl)] bg-[var(--color-card)] p-8 shadow-[var(--shadow-lg)]">
                <LogoReducido className="max-w-[60%] opacity-30" />
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
