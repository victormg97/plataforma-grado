import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { tenantConfig } from '@/config';
import {
  loadLegalDocument,
  formatOwnerNames,
  formatOwnerEmails,
} from '@/lib/tenant-utils';
import { AVAILABLE_LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE } from '@/lib/config/locales';

/**
 * GET /api/legal/terminos
 *
 * Devuelve el contenido Markdown de los Términos y Condiciones del tenant activo,
 * con los placeholders ya reemplazados. Usado por el modal de T&C en /setup/[code].
 */
export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  const validCodes = AVAILABLE_LOCALES.map((l) => l.code) as string[];
  const locale = (raw && validCodes.includes(raw) ? raw : DEFAULT_LOCALE) as typeof DEFAULT_LOCALE;

  const { content: raw_md } = loadLegalDocument('terminos', tenantConfig.id, locale);

  const content = raw_md
    .replaceAll('{{APP_NAME}}', tenantConfig.nombre)
    .replaceAll('{{OWNER_NAME}}', formatOwnerNames(tenantConfig.propietarios))
    .replaceAll('{{OWNER_EMAIL}}', formatOwnerEmails(tenantConfig.propietarios));

  return NextResponse.json({ content });
}
