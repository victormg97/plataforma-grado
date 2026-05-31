'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Mail, ExternalLink } from 'lucide-react';
import {
  SiInstagram,
  SiX,
  SiFacebook,
  SiYoutube,
  SiTiktok,
  SiPinterest,
  SiWhatsapp,
} from 'react-icons/si';
import { ExternalLinkModal } from '@/components/common/ExternalLinkModal';
import type { TenantContactInfo } from '@/lib/supabase/types';

// ─── Icon map ─────────────────────────────────────────────────────────────────

type IconComponent = React.ComponentType<{ style?: React.CSSProperties; className?: string }>;

const SOCIAL_ICON_MAP: Record<string, { icon: IconComponent; color: string }> = {
  instagram: { icon: SiInstagram as IconComponent, color: '#E1306C' },
  twitter:   { icon: SiX as IconComponent,         color: '#000000' },
  x:         { icon: SiX as IconComponent,         color: '#000000' },
  facebook:  { icon: SiFacebook as IconComponent,  color: '#1877F2' },
  youtube:   { icon: SiYoutube as IconComponent,   color: '#FF0000' },
  tiktok:    { icon: SiTiktok as IconComponent,    color: '#000000' },
  pinterest: { icon: SiPinterest as IconComponent, color: '#E60023' },
  whatsapp:  { icon: SiWhatsapp as IconComponent,  color: '#25D366' },
};

function getIconForLabel(label: string): { icon: IconComponent; color: string } | null {
  const key = label.toLowerCase().trim();
  return SOCIAL_ICON_MAP[key] ?? null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContactColumnProps {
  entries: TenantContactInfo[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ContactColumn({ entries }: ContactColumnProps) {
  const t = useTranslations('quienesSomos');
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [pendingTitle, setPendingTitle] = useState<string | undefined>(undefined);

  function handleLinkClick(e: React.MouseEvent, url: string, title?: string) {
    // mailto: links open directly
    if (url.startsWith('mailto:')) return;
    e.preventDefault();
    setPendingUrl(url);
    setPendingTitle(title);
  }

  function handleConfirm() {
    if (pendingUrl) {
      window.open(pendingUrl, '_blank', 'noopener,noreferrer');
    }
    setPendingUrl(null);
    setPendingTitle(undefined);
  }

  function handleCancel() {
    setPendingUrl(null);
    setPendingTitle(undefined);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Title */}
      <h3
        className="text-base font-semibold text-[var(--color-text-primary)] mb-4"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {t('contacto_titulo')}
      </h3>

      {/* Entries */}
      <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
        {entries.map((entry) => {
          const isEmail = entry.type === 'email';
          const isWhatsApp = entry.type === 'whatsapp';
          const isSocial = entry.type === 'social';

          let IconEl: IconComponent | null = null;
          let iconColor = 'var(--color-text-muted)';

          if (isWhatsApp) {
            IconEl = SiWhatsapp as IconComponent;
            iconColor = '#25D366';
          } else if (isSocial) {
            const match = getIconForLabel(entry.label);
            if (match) {
              IconEl = match.icon;
              iconColor = match.color;
            }
          }

          return (
            <a
              key={entry.id}
              href={entry.url}
              target={isEmail ? undefined : '_blank'}
              rel={isEmail ? undefined : 'noopener noreferrer'}
              onClick={(e) => handleLinkClick(e, entry.url, entry.label)}
              className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2.5 hover:border-[var(--color-brand-gold)] hover:bg-[var(--color-bg-secondary)] transition-colors group"
            >
              {/* Icon */}
              <span className="shrink-0 size-5 flex items-center justify-center">
                {isEmail ? (
                  <Mail className="size-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-brand-gold)] transition-colors" />
                ) : IconEl ? (
                  <IconEl style={{ color: iconColor }} className="size-4" />
                ) : (
                  <ExternalLink className="size-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-brand-gold)] transition-colors" />
                )}
              </span>

              {/* Text */}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[var(--color-text-muted)] truncate">{entry.label}</p>
                <p className="text-sm text-[var(--color-text-primary)] truncate">{entry.value}</p>
              </div>
            </a>
          );
        })}
      </div>

      {/* ExternalLinkModal */}
      {pendingUrl && (
        <ExternalLinkModal
          url={pendingUrl}
          title={pendingTitle}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
