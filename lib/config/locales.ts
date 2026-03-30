export const AVAILABLE_LOCALES = [
  { code: 'es', label: 'Español', flag: '🇨🇱' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
] as const;

export type LocaleCode = (typeof AVAILABLE_LOCALES)[number]['code'];

export const DEFAULT_LOCALE: LocaleCode = 'es';
export const LOCALE_COOKIE = 'NEXT_LOCALE';
