'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { m } from 'framer-motion';
import { AppLogo } from '@/components/common/AppLogo';

const easeOut = [0.22, 1, 0.36, 1] as const;

interface HeroProps {
  /** Ruta pública de la imagen del hero, ya resuelta en el servidor. null = sin imagen */
  imageSrc: string | null;
}

export function Hero({ imageSrc }: HeroProps) {
  const t = useTranslations('landing-pregunta-estrategica.hero');
  const hasImage = imageSrc !== null;

  // Título reutilizado en ambos layouts. `onDark` ajusta los colores cuando
  // el texto va sobre la imagen (móvil/tablet).
  const Titulo = ({ onDark = false }: { onDark?: boolean }) => (
    <h1
      className="font-bold leading-[0.95] tracking-tight break-words hyphens-auto"
      style={{ fontFamily: 'var(--font-display)' }}
    >
      <span
        className={`block text-[clamp(2.25rem,9vw,4.5rem)] lg:text-[clamp(2.5rem,4.5vw,4.5rem)] ${
          onDark ? 'text-white' : 'text-[var(--color-text-primary)]'
        }`}
      >
        {t('titulo1')}
      </span>
      <span
        className={`block text-[clamp(2.25rem,9vw,4.5rem)] lg:text-[clamp(2.5rem,4.5vw,4.5rem)] ${
          onDark ? 'text-[var(--color-brand-gold-light)]' : 'text-[var(--color-brand-gold)]'
        }`}
      >
        {t('titulo2')}
      </span>
      <span
        className={`block text-[clamp(2.25rem,9vw,4.5rem)] lg:text-[clamp(2.5rem,4.5vw,4.5rem)] ${
          onDark ? 'text-[var(--color-brand-gold-light)]' : 'text-[var(--color-brand-gold)]'
        }`}
      >
        {t('titulo3')}
      </span>
    </h1>
  );

  const LineaDecorativa = ({ onDark = false }: { onDark?: boolean }) => (
    <div className="my-6 flex items-center gap-2" aria-hidden>
      <span className={`size-2.5 rounded-full ${onDark ? 'bg-white' : 'bg-[var(--color-text-primary)]'}`} />
      <span className={`h-0.5 flex-1 max-w-[180px] ${onDark ? 'bg-white' : 'bg-[var(--color-text-primary)]'}`} />
      <span className={`size-2.5 rounded-full ${onDark ? 'bg-white' : 'bg-[var(--color-text-primary)]'}`} />
    </div>
  );

  return (
    <section className="relative overflow-hidden bg-[var(--color-bg)]">
      {/* ════════════════════════════════════════════════════════════════════
          MÓVIL / TABLET (< lg): imagen de fondo (CSS) con velo + texto encima
          ════════════════════════════════════════════════════════════════════ */}
      <div className="relative lg:hidden">
        {/* Fondo: imagen vía CSS (no dispara warning de sizes) o color de marca */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-center"
          style={{
            backgroundColor: 'var(--color-brand-gold)',
            backgroundImage: hasImage ? `url("${imageSrc}")` : undefined,
          }}
        >
          {/* Velo para legibilidad del texto */}
          <div className="absolute inset-0 bg-gradient-to-br from-black/75 via-black/60 to-black/45" />
        </div>

        <m.div
          className="container-landing relative z-10 flex min-h-[78vh] flex-col justify-center py-16"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: easeOut }}
        >
          <Titulo onDark />
          <LineaDecorativa onDark />
          <p className="max-w-md text-[clamp(1rem,3.5vw,1.25rem)] leading-relaxed text-white/90">
            {t('subtitulo')}
            <strong className="font-bold text-[var(--color-brand-gold-light)]">
              {t('subtituloDestacado')}
            </strong>
          </p>
        </m.div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          DESKTOP (lg+): dos columnas (texto | imagen)
          ════════════════════════════════════════════════════════════════════ */}
      <div className="container-landing hidden items-center gap-12 py-20 lg:grid lg:grid-cols-2">
        {/* Texto */}
        <m.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: easeOut }}
        >
          <Titulo />
          <LineaDecorativa />
          <p className="max-w-md text-[clamp(1rem,2.2vw,1.25rem)] leading-relaxed text-[var(--color-text-secondary)]">
            {t('subtitulo')}
            <strong className="font-bold text-[var(--color-brand-gold)]">
              {t('subtituloDestacado')}
            </strong>
          </p>
        </m.div>

        {/* Imagen */}
        <m.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15, ease: easeOut }}
        >
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-bg-secondary)] shadow-[var(--shadow-lg)]">
            {hasImage ? (
              <Image
                src={imageSrc}
                alt={t('imagenAlt')}
                fill
                sizes="(min-width: 1440px) 700px, 50vw"
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center p-8">
                <AppLogo variant="login" />
              </div>
            )}
          </div>
        </m.div>
      </div>
    </section>
  );
}
