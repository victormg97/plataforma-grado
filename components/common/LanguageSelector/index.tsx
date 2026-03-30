'use client';

import { useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import { AVAILABLE_LOCALES, LOCALE_COOKIE, type LocaleCode } from '@/lib/config/locales';
import { setLocaleAction } from '@/app/actions/setLocale';
import { cn } from '@/lib/utils';

const DEBOUNCE_MS = 800;

interface LanguageSelectorProps {
  currentLocale: string;
  /** Called after locale is changed so callers can react (e.g. update DB) */
  onLocaleChange?: (locale: LocaleCode) => void;
  className?: string;
}

export function LanguageSelector({ currentLocale, onLocaleChange, className }: LanguageSelectorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const locale = e.target.value as LocaleCode;

    // 1. Optimistic: set cookie client-side immediately so router.refresh() picks it up
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;

    // 2. Re-render immediately with the new locale
    startTransition(() => {
      router.refresh();
    });

    // 3. Debounced: persist to server-side cookie + DB in the background
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLocaleAction(locale).catch(() => {});
      onLocaleChange?.(locale);
    }, DEBOUNCE_MS);
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="block text-sm font-medium text-[var(--color-text-primary)]">
        Idioma / Language
      </label>
      <div className="relative flex items-center">
        <Globe className="pointer-events-none absolute left-2.5 h-4 w-4 text-[var(--color-text-muted)]" />
        <select
          value={currentLocale}
          onChange={handleChange}
          disabled={isPending}
          className={cn(
            'w-full rounded-[var(--radius-md)] border border-[var(--color-border)]',
            'bg-[var(--color-bg)] py-2 pl-8 pr-3 text-sm text-[var(--color-text-primary)]',
            'focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]',
            'transition-colors hover:border-[var(--color-border-strong)]',
            'disabled:opacity-60',
          )}
        >
          {AVAILABLE_LOCALES.map((loc) => (
            <option key={loc.code} value={loc.code}>
              {loc.flag} {loc.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
