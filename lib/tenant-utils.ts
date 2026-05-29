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
