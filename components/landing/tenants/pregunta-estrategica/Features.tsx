'use client';

import { useTranslations } from 'next-intl';
import { BookOpen, MessagesSquare, Lightbulb, Laptop, Scale } from 'lucide-react';
import { Reveal } from '../../shared/Reveal';

const FEATURES = [
  { key: 'metodologia', Icon: BookOpen },
  { key: 'interrogaciones', Icon: MessagesSquare },
  { key: 'estrategica', Icon: Lightbulb },
  { key: 'plataforma', Icon: Laptop },
  { key: 'baseDatos', Icon: Scale },
] as const;

/**
 * Banda de características sobre fondo burdeo (color accent del tenant).
 * Cinco íconos con separadores verticales, responsive a grid en móvil.
 */
export function Features() {
  const t = useTranslations('landing-pregunta-estrategica.features');

  return (
    <section
      className="text-white"
      style={{ backgroundColor: 'var(--color-brand-gold)' }}
    >
      <div className="container-landing py-8 md:py-10">
        <ul className="grid grid-cols-2 gap-x-2 gap-y-8 sm:grid-cols-3 lg:grid-cols-5 lg:gap-0">
          {FEATURES.map(({ key, Icon }, i) => (
            <Reveal
              key={key}
              delay={i * 0.08}
              direction="up"
              className={`flex flex-col items-center gap-3 px-3 text-center lg:px-5 ${
                i < FEATURES.length - 1 ? 'lg:border-r lg:border-white/25' : ''
              }`}
            >
              <Icon className="size-9 stroke-[1.25] md:size-10" />
              <span className="text-sm font-medium leading-snug underline-offset-4">
                {t(key)}
              </span>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
