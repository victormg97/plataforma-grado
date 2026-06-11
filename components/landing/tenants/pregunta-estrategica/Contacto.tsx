'use client';

import { useTranslations } from 'next-intl';
import { Mail, ExternalLink, ArrowRight } from 'lucide-react';
import { SiInstagram, SiWhatsapp, SiFacebook, SiYoutube, SiTiktok } from 'react-icons/si';
import { useContactInfo } from '@/components/common/WhoWeAre/hooks/useContactInfo';
import { tenantConfig } from '@/config';
import { Reveal } from '../../shared/Reveal';
import { LogoCompleto } from './LogoCompleto';
import type { TenantContactInfo } from '@/lib/supabase/types';

type IconComponent = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

const SOCIAL_ICONS: Record<string, { icon: IconComponent; color: string }> = {
  instagram: { icon: SiInstagram as IconComponent, color: '#E1306C' },
  facebook: { icon: SiFacebook as IconComponent, color: '#1877F2' },
  youtube: { icon: SiYoutube as IconComponent, color: '#FF0000' },
  tiktok: { icon: SiTiktok as IconComponent, color: '#000000' },
};

/** Resuelve ícono y color para una entrada de contacto. */
function resolveIcon(entry: TenantContactInfo): { Icon: IconComponent; color: string } {
  if (entry.type === 'whatsapp') return { Icon: SiWhatsapp as IconComponent, color: '#25D366' };
  if (entry.type === 'email') return { Icon: Mail as IconComponent, color: 'var(--color-brand-gold)' };
  if (entry.type === 'social') {
    const match = SOCIAL_ICONS[entry.label.toLowerCase().trim()];
    if (match) return { Icon: match.icon, color: match.color };
  }
  return { Icon: ExternalLink as IconComponent, color: 'var(--color-brand-gold)' };
}

export function Contacto() {
  const t = useTranslations('landing-pregunta-estrategica.contacto');
  const { entries } = useContactInfo(tenantConfig.id);

  function ctaLabel(entry: TenantContactInfo): string {
    if (entry.type === 'whatsapp') return t('ctaWhatsapp');
    if (entry.type === 'email') return t('ctaEmail');
    return t('ctaSocial');
  }

  return (
    <section id="contacto" className="relative scroll-mt-20 bg-[var(--color-bg)]">
      <div className="container-landing landing-section relative">
        <div className="mx-auto w-full max-w-5xl">
          {/* Encabezado */}
          <Reveal className="flex flex-col items-center text-center">
            <h2
              className="text-[clamp(1.5rem,4vw,2.5rem)] font-bold uppercase tracking-wide text-[var(--color-text-primary)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {t('titulo')}
            </h2>
            <p
              className="mt-1 text-[clamp(1.1rem,2.5vw,1.5rem)] text-[var(--color-brand-gold)]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {t('subtitulo')}
            </p>
            <p className="mt-3 max-w-2xl text-[clamp(0.9rem,1.3vw,1.05rem)] leading-relaxed text-[var(--color-text-secondary)]">
              {t('descripcion')}
            </p>
          </Reveal>

          {/* Frase de agendamiento + canales */}
          <Reveal delay={0.08} className="mt-5 flex flex-col items-center gap-3 text-center">
            <p
              className="w-full max-w-3xl rounded-[var(--radius-lg)] px-6 py-2.5 text-[clamp(0.9rem,1.2vw,1.05rem)] font-medium leading-snug text-[var(--color-text-primary)]"
              style={{ backgroundColor: 'color-mix(in srgb, var(--color-brand-gold) 12%, var(--color-card))' }}
            >
              {t('agendar')}
            </p>
            <p
              className="text-[clamp(0.8rem,1.1vw,0.95rem)] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]"
            >
              {t('canales')}
            </p>
          </Reveal>

          {/* Tarjetas de contacto */}
          <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 sm:[grid-template-columns:repeat(2,minmax(0,1fr))]">
            {entries.map((entry, i) => {
              const { Icon, color } = resolveIcon(entry);
              const isEmail = entry.type === 'email';

              return (
                <Reveal key={entry.id} direction="up" delay={i * 0.08} className="min-w-0">
                  <a
                    href={entry.url}
                    target={isEmail ? undefined : '_blank'}
                    rel={isEmail ? undefined : 'noopener noreferrer'}
                    className="group flex h-full w-full items-center gap-4 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-sm)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-brand-gold)] hover:shadow-[var(--shadow-md)]"
                  >
                    {/* Ícono */}
                    <span
                      className="flex size-12 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${color}1A` }}
                    >
                      <Icon className="size-6" style={{ color }} />
                    </span>

                    {/* Texto */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[var(--color-text-muted)]">{entry.label}</p>
                      <p className="truncate font-semibold text-[var(--color-text-primary)]">
                        {entry.value}
                      </p>
                    </div>

                    {/* CTA — solo desktop (es un afford de hover, inútil en táctil) */}
                    <span className="hidden shrink-0 items-center gap-1 text-sm font-medium text-[var(--color-brand-gold)] opacity-0 transition-opacity duration-300 group-hover:opacity-100 sm:flex">
                      {ctaLabel(entry)}
                      <ArrowRight className="size-4" />
                    </span>
                  </a>
                </Reveal>
              );
            })}
          </div>
        </div>

        {/* Logo completo en esquina inferior derecha */}
        <div className="pointer-events-none absolute bottom-4 right-2 opacity-30 sm:bottom-6 sm:right-4 sm:opacity-40 lg:bottom-10 lg:right-8 lg:opacity-70" aria-hidden>
          <LogoCompleto className="h-12 w-auto sm:h-16 md:h-20 lg:h-28" />
        </div>
      </div>
    </section>
  );
}
