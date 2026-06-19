'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useUserStore } from '@/stores/useUserStore';
import { Loader2, Mail, Users, Globe, ChevronRight, Palette, Tag, Camera } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConfigCard {
  href: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  badge?: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConfigSectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {title}
      </h2>
      {description && (
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{description}</p>
      )}
    </div>
  );
}

function ConfigCard({ href, icon: Icon, iconColor, iconBg, title, description, badge }: ConfigCard) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)]',
        'bg-[var(--color-bg)] p-5 transition-all duration-200',
        'hover:border-[var(--color-brand-gold)] hover:shadow-sm',
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)]',
          iconBg,
        )}
      >
        <Icon className={cn('size-5', iconColor)} />
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-brand-gold)] transition-colors">
            {title}
          </span>
          {badge && (
            <span className="rounded-full bg-[color-mix(in_srgb,var(--color-brand-gold)_15%,transparent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-brand-gold)]">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)] leading-relaxed">
          {description}
        </p>
      </div>

      {/* Arrow */}
      <ChevronRight className="size-4 shrink-0 text-[var(--color-text-muted)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--color-brand-gold)]" />
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConfiguracionPaginaPage() {
  const { user } = useUserStore();
  const router = useRouter();
  const t = useTranslations('configuracionPagina');
  const tp = useTranslations('plantillasCorreo');
  const tqs = useTranslations('quienesSomos');
  const tpl = useTranslations('planesConfig');
  const tsn = useTranslations('sobreNosotrasConfig');

  // Guard: solo admins
  useEffect(() => {
    if (user && user.rol !== 'admin') {
      router.replace('/perfil');
    }
  }, [user, router]);

  if (!user) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-[var(--color-brand-gold)]" />
      </div>
    );
  }

  if (user.rol !== 'admin') return null;

  const contenidoCards: ConfigCard[] = [
    {
      href: '/pagina/quienes-somos',
      icon: Users,
      iconColor: 'text-[var(--color-brand-gold)]',
      iconBg: 'bg-[color-mix(in_srgb,var(--color-brand-gold)_12%,transparent)]',
      title: tqs('perfil_titulo'),
      description: tqs('perfil_subtitulo'),
    },
    {
      href: '/pagina/planes',
      icon: Tag,
      iconColor: 'text-[#10b981]',
      iconBg: 'bg-[color-mix(in_srgb,#10b981_12%,transparent)]',
      title: tpl('navbar_label'),
      description: tpl('subtitulo'),
    },
    {
      href: '/pagina/sobre-nosotras-imagenes',
      icon: Camera,
      iconColor: 'text-[#8b5cf6]',
      iconBg: 'bg-[color-mix(in_srgb,#8b5cf6_12%,transparent)]',
      title: tsn('navbar_label'),
      description: tsn('subtitulo'),
    },
  ];

  const comunicacionCards: ConfigCard[] = [
    {
      href: '/pagina/plantillas-correo',
      icon: Mail,
      iconColor: 'text-[#6366f1]',
      iconBg: 'bg-[color-mix(in_srgb,#6366f1_12%,transparent)]',
      title: tp('titulo'),
      description: tp('subtitulo'),
    },
  ];

  return (
    <div className="space-y-10">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[color-mix(in_srgb,var(--color-brand-gold)_12%,transparent)]">
          <Globe className="size-6 text-[var(--color-brand-gold)]" />
        </div>
        <div>
          <h1
            className="text-2xl font-bold text-[var(--color-text-primary)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t('titulo')}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 leading-relaxed max-w-lg">
            {t('subtitulo')}
          </p>
        </div>
      </div>

      {/* ── Grid de secciones ─────────────────────────────────────────── */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* ── Contenido público ── */}
        <section>
          <ConfigSectionTitle title={t('seccion_contenido')} />
          <div className="grid gap-3">
            {contenidoCards.map((card) => (
              <ConfigCard key={card.href} {...card} />
            ))}
          </div>
        </section>

        {/* ── Comunicación ── */}
        <section>
          <ConfigSectionTitle title={t('seccion_comunicacion')} />
          <div className="grid gap-3">
            {comunicacionCards.map((card) => (
              <ConfigCard key={card.href} {...card} />
            ))}
          </div>
        </section>
      </div>

      {/* ── Próximamente ──────────────────────────────────────────────── */}
      <section>
        <ConfigSectionTitle title={t('seccion_proximamente')} />
        <div
          className={cn(
            'flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)]',
            'border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)]',
            'px-6 py-8 text-center',
          )}
        >
          <div className="flex size-10 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-text-muted)_10%,transparent)]">
            <Palette className="size-5 text-[var(--color-text-muted)]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
              {t('proximamente_titulo')}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1 max-w-xs">
              {t('proximamente_desc')}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
