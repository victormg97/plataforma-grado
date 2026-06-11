'use client';

import Image from 'next/image';
import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { m } from 'framer-motion';
import { BookOpen, Lightbulb, Users, GraduationCap } from 'lucide-react';
import { Reveal } from '../../shared/Reveal';

const easeOut = [0.22, 1, 0.36, 1] as const;

/**
 * Banner motivacional con efecto "spotlight" que sigue al cursor.
 * El brillo se controla con variables CSS (--mx / --my) actualizadas en el
 * propio nodo, sin disparar re-renders de React → animación fluida y elegante.
 */
function BannerMotivacional({ texto }: { texto: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.setProperty('--mx', `${x}px`);
    el.style.setProperty('--my', `${y}px`);

    // Rotación muy leve del birrete según la posición horizontal del cursor:
    // -8° (izquierda) → +8° (derecha).
    if (iconRef.current) {
      const ratio = x / rect.width - 0.5; // -0.5 … 0.5
      iconRef.current.style.transform = `rotate(${ratio * 16}deg)`;
    }
  };

  const handleMouseLeave = () => {
    if (iconRef.current) iconRef.current.style.transform = 'rotate(0deg)';
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="banner-spotlight group relative cursor-default overflow-hidden rounded-[var(--radius-lg)] px-6 py-4 transition-shadow duration-500 hover:shadow-[var(--shadow-lg)] sm:px-10 sm:py-5"
      style={{
        border: '1px solid color-mix(in srgb, var(--color-brand-gold) 40%, transparent)',
        backgroundColor: 'color-mix(in srgb, var(--color-brand-gold) 8%, var(--color-card))',
      }}
    >
      {/* Capa spotlight: brillo radial que sigue al cursor */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(180px circle at var(--mx, 50%) var(--my, 50%), color-mix(in srgb, var(--color-brand-gold) 24%, transparent), transparent 60%)',
        }}
      />
      {/* Acento lateral en color de marca */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ backgroundColor: 'var(--color-brand-gold)' }}
      />

      <div className="relative flex items-center justify-center gap-4">
        <span
          ref={iconRef}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-white shadow-[var(--shadow-md)] transition-transform duration-300 ease-out sm:size-12"
          style={{ backgroundColor: 'var(--color-brand-gold)' }}
        >
          <GraduationCap className="size-5 sm:size-6" />
        </span>
        <p
          className="text-[clamp(1rem,1.6vw,1.4rem)] font-semibold italic tracking-wide text-[var(--color-text-primary)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {texto}
        </p>
      </div>
    </div>
  );
}

interface TutoriasProps {
  /** Ruta pública de la imagen, resuelta en el servidor. null = sin imagen */
  imageSrc: string | null;
}

/**
 * Sección "Tutorías para estudiantes de pregrado".
 *
 * Desktop (lg+): el contenido (título + beneficios | separador | materias)
 * ocupa la franja izquierda, y una imagen vertical se ancla a la derecha con
 * un degradado que la funde con el fondo de la sección.
 *
 * Móvil/tablet: todo se apila en una columna y la imagen se muestra como una
 * tarjeta redondeada en el flujo.
 */
export function Tutorias({ imageSrc }: TutoriasProps) {
  const t = useTranslations('landing-pregunta-estrategica.tutorias');
  const materias = t.raw('materias') as string[];
  const hasImage = imageSrc !== null;

  const beneficios = [
    { key: 'apoyo', Icon: BookOpen },
    { key: 'metodologia', Icon: Lightbulb },
    { key: 'acompanamiento', Icon: Users },
  ] as const;

  /* ── Encabezado (título + línea decorativa + descripción) ── */
  const Encabezado = (
    <Reveal direction="up">
      <h2
        className="text-[clamp(2rem,5vw,3.25rem)] font-bold uppercase leading-[0.95] tracking-[0.04em] text-[var(--color-text-primary)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {t('titulo')}
      </h2>
      <p
        className="mt-2 text-[clamp(1rem,1.9vw,1.35rem)] font-bold uppercase tracking-[0.04em] text-[var(--color-brand-gold)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {t('subtitulo')}
      </p>

      {/* Línea decorativa: punto — línea — punto (ancho completo del bloque) */}
      <div className="mt-4 flex items-center gap-2" aria-hidden>
        <span className="size-2.5 shrink-0 rounded-full bg-[var(--color-text-primary)]" />
        <span className="h-0.5 flex-1 bg-[var(--color-text-primary)]" />
        <span className="size-2.5 shrink-0 rounded-full bg-[var(--color-text-primary)]" />
      </div>

      <p className="mt-5 max-w-md text-[clamp(1rem,1.4vw,1.2rem)] font-semibold leading-snug text-[var(--color-text-primary)]">
        {t('descripcion')}
      </p>
    </Reveal>
  );

  /* ── Lista de beneficios con íconos circulares ── */
  const Beneficios = (
    <div className="mt-6 space-y-4">
      {beneficios.map(({ key, Icon }, i) => (
        <Reveal key={key} delay={0.1 + i * 0.1} direction="up">
          <div className="flex items-center gap-4">
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-white shadow-[var(--shadow-md)]"
              style={{ backgroundColor: 'var(--color-brand-gold)' }}
            >
              <Icon className="size-5" />
            </span>
            <p className="text-[clamp(0.95rem,1.2vw,1.1rem)] leading-snug text-[var(--color-text-primary)]">
              {t(`beneficios.${key}`)}
            </p>
          </div>
        </Reveal>
      ))}
    </div>
  );

  /* ── Tarjeta de materias + nota de duración ── */
  const Materias = (
    <Reveal direction="left" delay={0.15}>
      <h3
        className="text-center text-[clamp(1.05rem,1.7vw,1.35rem)] font-bold uppercase tracking-wide text-[var(--color-text-primary)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {t('materiasTitulo')}
      </h3>
      <div className="mt-4 rounded-[var(--radius-xl)] bg-[var(--color-card)] p-6 shadow-[var(--shadow-lg)] md:p-7">
        <ul className="space-y-3">
          {materias.map((materia) => (
            <li
              key={materia}
              className="flex items-center gap-3 text-[clamp(0.95rem,1.2vw,1.1rem)] font-medium text-[var(--color-text-primary)]"
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: 'var(--color-brand-gold)' }}
              />
              <span>{materia}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-5 text-center text-[clamp(0.9rem,1.2vw,1.05rem)] leading-snug text-[var(--color-text-secondary)]">
        {t('duracion')}
      </p>
    </Reveal>
  );

  return (
    <section id="tutorias" className="relative scroll-mt-20 overflow-hidden bg-[var(--color-section-alt)]">
      {/* ── Imagen vertical anclada a la derecha (solo desktop) ── */}
      {hasImage && (
        <div className="absolute inset-y-0 right-0 hidden w-[22%] lg:block xl:w-[20%]" aria-hidden>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url("${imageSrc}")` }}
          />
          {/* Degradado que funde el borde izquierdo de la imagen con el fondo */}
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-section-alt)] via-[var(--color-section-alt)]/55 to-transparent" />
        </div>
      )}

      <div className="container-landing landing-section relative z-10">
        {/* Contenido confinado a la izquierda en desktop SOLO si hay imagen a la derecha */}
        <div className={hasImage ? 'lg:pr-[20%] xl:pr-[18%]' : ''}>
          {/* ── Rejilla principal: texto+beneficios | separador | materias ── */}
          <div className="grid items-start gap-8 lg:grid-cols-[1.05fr_auto_1fr] lg:gap-12">
            {/* Columna izquierda */}
            <div>
              {Encabezado}
              {Beneficios}
            </div>

            {/* Separador vertical (solo desktop) */}
            <div className="hidden w-px self-stretch bg-[var(--color-border-strong)] lg:block" aria-hidden />

            {/* Columna derecha: materias */}
            <div>
              {/* Imagen en móvil/tablet (la versión desktop va anclada a la derecha) */}
              {hasImage && (
                <m.div
                  className="mb-8 lg:hidden"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.6, ease: easeOut }}
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-lg)]">
                    <Image
                      src={imageSrc}
                      alt={t('imagenAlt')}
                      fill
                      sizes="(min-width: 1024px) 0px, 90vw"
                      className="object-cover"
                    />
                  </div>
                </m.div>
              )}

              {Materias}
            </div>
          </div>

          {/* ── Banner motivacional inferior (spotlight que sigue al cursor) ── */}
          <Reveal delay={0.2} direction="up">
            <div className="mt-8">
              <BannerMotivacional texto={t('banner')} />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
