import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { AVAILABLE_LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE } from '@/lib/config/locales';

const validCodes: string[] = AVAILABLE_LOCALES.map((l) => l.code);

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = (raw && validCodes.includes(raw) ? raw : DEFAULT_LOCALE) as typeof DEFAULT_LOCALE;

  const baseMessages = (await import(`../messages/${locale}.json`)).default;

  // Auto-merge page-specific message files from messages/pages/[locale]/*.json
  // To add messages for a new page, just drop a .json file in that directory.
  const pagesDir = join(process.cwd(), 'messages', 'pages', locale);
  const pageMessages: Record<string, unknown> = {};
  if (existsSync(pagesDir)) {
    const files = readdirSync(pagesDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const namespace = file.replace('.json', '');
      pageMessages[namespace] = JSON.parse(
        readFileSync(join(pagesDir, file), 'utf-8')
      );
    }
  }

  return {
    locale,
    messages: { ...baseMessages, ...pageMessages },
  };
});
