import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { AVAILABLE_LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE } from '@/lib/config/locales';

const validCodes: string[] = AVAILABLE_LOCALES.map((l) => l.code);

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = (raw && validCodes.includes(raw) ? raw : DEFAULT_LOCALE) as typeof DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
