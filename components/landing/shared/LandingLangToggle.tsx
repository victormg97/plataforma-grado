'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import { AVAILABLE_LOCALES, LOCALE_COOKIE, type LocaleCode } from '@/lib/config/locales';
import { setLocaleAction } from '@/app/actions/setLocale';

/**
 * Toggle de idioma compacto para la navbar del landing.
 * Cicla entre los idiomas disponibles (es ⇄ en) con un clic.
 */
export function LandingLangToggle({ currentLocale }: { currentLocale: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function cycleLocale() {
    const codes = AVAILABLE_LOCALES.map((l) => l.code) as string[];
    const idx = codes.indexOf(currentLocale);
    const next = codes[(idx + 1) % codes.length] as LocaleCode;

    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    startTransition(() => {
      router.refresh();
    });
    setLocaleAction(next).catch(() => {});
  }

  const current = AVAILABLE_LOCALES.find((l) => l.code === currentLocale) ?? AVAILABLE_LOCALES[0];

  return (
    <button
      onClick={cycleLocale}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-60"
      aria-label={`Idioma: ${current.label}`}
    >
      <Globe className="size-4" />
      <span className="uppercase">{current.code}</span>
    </button>
  );
}
