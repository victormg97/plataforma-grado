import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { TenantConfig } from '@/config/schema';

type Owner = TenantConfig['propietarios'][number];

/**
 * Formatea los nombres de los propietarios para mostrar en documentos legales.
 * - 1 propietario: "Carlos Toro Araya"
 * - 2 propietarios: "Estefanía Montalbán Pino y Camila Ogalde Fonck"
 * - 3+: "A, B y C"
 */
export function formatOwnerNames(propietarios: Owner[]): string {
  if (propietarios.length === 0) return '';
  if (propietarios.length === 1) return propietarios[0].nombre;

  const nombres = propietarios.map((p) => p.nombre);
  const last = nombres.pop()!;
  return `${nombres.join(', ')} y ${last}`;
}

/**
 * Formatea los emails de los propietarios para mostrar en documentos legales.
 * - Si todos comparten el mismo email, muestra uno solo.
 * - Si son distintos, los muestra separados por " / ".
 */
export function formatOwnerEmails(propietarios: Owner[]): string {
  if (propietarios.length === 0) return '';

  const uniqueEmails = [...new Set(propietarios.map((p) => p.email))];
  return uniqueEmails.join(' / ');
}

// ─── Carga de documentos legales con fallback por tenant ─────────────────────

export type LegalDocType = 'privacidad' | 'terminos' | 'referidos-terminos';

/**
 * Carga un documento legal con lógica de fallback:
 *
 * 1. Busca en `content/tenants/{tenantId}/{locale}/{doc}.md`  (documento propio del tenant)
 * 2. Si no existe, cae al global `content/{locale}/{doc}.md`
 *
 * La política de privacidad global representa la plataforma (desarrollador).
 * Los términos y condiciones globales son el fallback genérico para tenants
 * que aún no han subido los suyos. Lo mismo aplica a `referidos-terminos`
 * (T&C del programa de referidos): el archivo global es una plantilla que el
 * tenant sobrescribe dejando su propio documento en `content/tenants/...`.
 *
 * @returns { content: string; isCustom: boolean }
 *   - content: texto Markdown listo para reemplazar placeholders
 *   - isCustom: true si se usó el documento propio del tenant
 */
export function loadLegalDocument(
  doc: LegalDocType,
  tenantId: string,
  locale: string
): { content: string; isCustom: boolean } {
  const tenantPath = join(
    process.cwd(),
    'content',
    'tenants',
    tenantId,
    locale,
    `${doc}.md`
  );

  if (existsSync(tenantPath)) {
    return { content: readFileSync(tenantPath, 'utf-8'), isCustom: true };
  }

  const globalPath = join(process.cwd(), 'content', locale, `${doc}.md`);
  return { content: readFileSync(globalPath, 'utf-8'), isCustom: false };
}
