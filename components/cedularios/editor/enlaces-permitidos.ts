/**
 * Link URL check shared by the editor's Link extension and the link dialog.
 *
 * Mirrors `sanearHref` in `lib/cedularios/richtext.ts`: an absolute URL with no
 * whitespace or control characters, at most 2048 characters, and a protocol in
 * `CAMPOS_ENLACE_PROTOCOLOS` (http, https, mailto). Anything else is rejected.
 */

import { CAMPOS_ENLACE_PROTOCOLOS } from '@/lib/cedularios/richtext';

const MAX_HREF = 2048;

/** Returns the trimmed URL when it is allowed, or `null` when it must be rejected. */
export function normalizarUrlEnlace(valor: string | null | undefined): string | null {
  if (typeof valor !== 'string') return null;
  const url = valor.trim();
  if (url.length === 0 || url.length > MAX_HREF) return null;
  for (let i = 0; i < url.length; i++) {
    const c = url.charCodeAt(i);
    if (c <= 0x20 || (c >= 0x7f && c <= 0x9f)) return null;
  }
  try {
    const protocolo = new URL(url).protocol;
    return (CAMPOS_ENLACE_PROTOCOLOS as readonly string[]).includes(protocolo) ? url : null;
  } catch {
    return null;
  }
}

export function esUrlEnlacePermitida(valor: string | null | undefined): boolean {
  return normalizarUrlEnlace(valor) !== null;
}
