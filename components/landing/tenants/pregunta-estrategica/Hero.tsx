'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { m } from 'framer-motion';
import { AppLogo } from '@/components/common/AppLogo';
import { SectionLink } from '../../shared/SectionLink';

const easeOut = [0.22, 1, 0.36, 1] as const;

// ─── Sub-components extracted outside Hero to avoid "cannot create components during render" ───

function Titulo({ onDark = false, t }: { onDark?: boolean; t: ReturnType<typeof useTranslations> }) {
  return (
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
}

function LineaDecorativa({ onDark = false }: { onDark?: boolean }) {
  return (
    <div className="my-6 flex items-center gap-2" aria-hidden>
      <span className={`size-2.5 rounded-full ${onDark ? 'bg-white' : 'bg-[var(--color-text-primary)]'}`} />
      <span className={`h-0.5 flex-1 max-w-[180px] ${onDark ? 'bg-white' : 'bg-[var(--color-text-primary)]'}`} />
      <span className={`size-2.5 rounded-full ${onDark ? 'bg-white' : 'bg-[var(--color-text-primary)]'}`} />
    </div>
  );
}

interface HeroProps {
  /** Ruta pública de la imagen del hero, ya resuelta en el servidor. null = sin imagen */
  imageSrc: string | null;
  /** Ruta del CTA principal: /login (no logeado) o dashboard (logeado) */
  ctaHref: string;
  /** Si el usuario tiene sesión activa */
  isLoggedIn: boolean;
}

// CTA above-the-fold. `onDark` cambia los colores para la variante móvil
// (texto sobre imagen con velo oscuro).
//
// - Primario: si hay sesión → va a la plataforma (ctaHref); si no → smooth-scroll
//   a la sección de contacto (#contacto).
// - Secundario: siempre smooth-scroll a la sección de planes (#planes).
function HeroCTA({
  ctaHref,
  isLoggedIn,
  onDark = false,
  t,
}: {
  ctaHref: string;
  isLoggedIn: boolean;
  onDark?: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const primaryClass =
    'inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-7 py-3 text-base font-semibold text-white shadow-[var(--shadow-md)] transition-transform hover:scale-[1.03] hover:opacity-95';
  const secondaryClass = `inline-flex items-center justify-center rounded-[var(--radius-md)] border px-7 py-3 text-base font-semibold transition-colors ${
    onDark
      ? 'border-white/70 text-white hover:bg-white/10'
      : 'border-[var(--color-brand-gold)] text-[var(--color-brand-gold)] hover:bg-[var(--color-brand-gold-muted)]'
  }`;

  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
      {isLoggedIn ? (
        // Con sesión → entra directo a la plataforma.
        <Link href={ctaHref} className={primaryClass}>
          {t('ctaPrimario')}
        </Link>
      ) : (
        // Sin sesión → lleva a la sección de contacto (misma página).
        <SectionLink sectionId="contacto" href="/contacto" className={primaryClass}>
          {t('ctaPrimario')}
        </SectionLink>
      )}
      <SectionLink sectionId="planes" href="/planes" className={secondaryClass}>
        {t('ctaSecundario')}
      </SectionLink>
    </div>
  );
}

export function Hero({ imageSrc, ctaHref, isLoggedIn }: HeroProps) {
  const t = useTranslations('landing-pregunta-estrategica.hero');
  const hasImage = imageSrc !== null;

  return (
    <section className="relative overflow-hidden bg-[var(--color-bg)]">
      {/* ════════════════════════════════════════════════════════════════════
          MÓVIL / TABLET (< lg): imagen de fondo (CSS) con velo + texto encima
          ════════════════════════════════════════════════════════════════════ */}
      <div className="relative lg:hidden">
        {/* Fondo: imagen optimizada por next/image (webp/avif, priority para el
            LCP móvil) o color de marca si no hay imagen. object-cover replica
            el comportamiento del antiguo background-size: cover. */}
        <div className="absolute inset-0 z-0" style={{ backgroundColor: 'var(--color-brand-gold)' }}>
          {hasImage && (
            <Image
              src={imageSrc}
              alt={t('imagenAlt')}
              fill
              sizes="100vw"
              className="object-cover object-center"
              priority
            />
          )}
          {/* Velo para legibilidad del texto */}
          <div className="absolute inset-0 bg-gradient-to-br from-black/75 via-black/60 to-black/45" />
        </div>

        <m.div
          className="container-landing relative z-10 flex min-h-[78vh] flex-col justify-center py-16"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: easeOut }}
        >
          <Titulo onDark t={t} />
          <LineaDecorativa onDark />
          <p className="max-w-md text-[clamp(1rem,3.5vw,1.25rem)] leading-relaxed text-white/90">
            {t('subtitulo')}
            <strong className="font-bold text-[var(--color-brand-gold-light)]">
              {t('subtituloDestacado')}
            </strong>
          </p>
          <HeroCTA ctaHref={ctaHref} isLoggedIn={isLoggedIn} onDark t={t} />
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
          <Titulo t={t} />
          <LineaDecorativa />
          <p className="max-w-md text-[clamp(1rem,2.2vw,1.25rem)] leading-relaxed text-[var(--color-text-secondary)]">
            {t('subtitulo')}
            <strong className="font-bold text-[var(--color-brand-gold)]">
              {t('subtituloDestacado')}
            </strong>
          </p>
          <HeroCTA ctaHref={ctaHref} isLoggedIn={isLoggedIn} t={t} />
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
