import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Strip HTML tags from a string, returning plain text. */
export function stripHtml(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<\/?(p|div|br|li|ul|ol|h[1-6]|blockquote|pre|tr)\b[^>]*>/gi, ' ')
      .replace(/<[^>]*>/g, ''),
  )
    .replace(/[\s\u00a0]+/g, ' ')
    .trim();
}

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  ntilde: 'ñ', Ntilde: 'Ñ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', uuml: 'ü',
  bull: '•', hellip: '…', ndash: '–', mdash: '—', laquo: '«', raquo: '»',
};

/** Decode the common named and numeric HTML entities (SSR-safe, no DOM needed). */
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, body: string) => {
    if (body[0] === '#') {
      const code = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    return NAMED_ENTITIES[body] ?? match;
  });
}

/** Plain-text preview of an HTML description, truncated on a word boundary. */
export function htmlToPreview(html: string, maxLength = 180): string {
  const text = stripHtml(html);
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
