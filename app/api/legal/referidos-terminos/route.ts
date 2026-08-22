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
 * GET /api/legal/referidos-terminos
 *
 * Devuelve el contenido Markdown de los Términos y Condiciones del PROGRAMA DE
 * REFERIDOS del tenant activo, con los placeholders ya reemplazados.
 *
 * Resolución del documento (`loadLegalDocument`):
 *   1. content/tenants/<tenantId>/<locale>/referidos-terminos.md  (propio del tenant)
 *   2. content/<locale>/referidos-terminos.md                     (plantilla global)
 *
 * Lo consume el modal (i) de la vista de referidos. Es contenido legal público
 * —igual que /api/legal/terminos— por lo que no requiere sesión.
 */
export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  const validCodes = AVAILABLE_LOCALES.map((l) => l.code) as string[];
  const locale = (raw && validCodes.includes(raw) ? raw : DEFAULT_LOCALE) as typeof DEFAULT_LOCALE;

  const { content: raw_md, isCustom } = loadLegalDocument(
    'referidos-terminos',
    tenantConfig.id,
    locale
  );

  const content = raw_md
    .replaceAll('{{APP_NAME}}', tenantConfig.nombre)
    .replaceAll('{{OWNER_NAME}}', formatOwnerNames(tenantConfig.propietarios))
    .replaceAll('{{OWNER_EMAIL}}', formatOwnerEmails(tenantConfig.propietarios));

  return NextResponse.json({ content, isCustom });
}
