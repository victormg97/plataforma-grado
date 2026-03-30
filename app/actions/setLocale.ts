'use server';

import { cookies } from 'next/headers';
import { AVAILABLE_LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE, type LocaleCode } from '@/lib/config/locales';

const validCodes = AVAILABLE_LOCALES.map((l) => l.code) as string[];

export async function setLocaleAction(locale: LocaleCode): Promise<void> {
  // Validate to prevent cookie injection
  const safe = validCodes.includes(locale) ? locale : DEFAULT_LOCALE;
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, safe, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
    httpOnly: false, // readable client-side for initializing state
  });
}
