/**
 * Minimal allow-list HTML sanitizer for rich-text descriptions (TipTap output).
 * SSR-safe (no DOM). Keeps a small set of formatting tags, drops every attribute
 * except a validated `href` on links, and removes script-like elements entirely.
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'u', 's', 'a',
  'h1', 'h2', 'h3', 'h4', 'blockquote', 'code', 'pre', 'hr', 'span',
]);
const VOID_TAGS = new Set(['br', 'hr']);
const SAFE_HREF = /^(https?:|mailto:|tel:|\/|#)/i;

function escapeText(text: string): string {
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function safeHref(attrs: string): string | null {
  const m = attrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  const raw = (m?.[1] ?? m?.[2] ?? m?.[3] ?? '').trim();
  // Strip control chars/whitespace that browsers ignore inside schemes ("java\tscript:")
  const href = raw.replace(/[\u0000-\u001f\u007f\s]/g, '');
  if (!href || !SAFE_HREF.test(href)) return null;
  return href.replace(/"/g, '&quot;').replace(/</g, '%3C').replace(/>/g, '%3E');
}

export function sanitizeHtml(input: string): string {
  const html = input.replace(
    /<(script|style|iframe|object|embed|noscript|template|svg|math)\b[\s\S]*?<\/\1\s*>/gi,
    '',
  );
  let out = '';
  let last = 0;
  const open: string[] = [];
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(html)) !== null) {
    out += escapeText(html.slice(last, match.index));
    last = match.index + match[0].length;
    const closing = match[1] === '/';
    const tag = match[2].toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) continue;
    if (VOID_TAGS.has(tag)) {
      if (!closing) out += `<${tag}>`;
      continue;
    }
    if (closing) {
      const idx = open.lastIndexOf(tag);
      if (idx === -1) continue;
      while (open.length > idx) out += `</${open.pop()}>`;
      continue;
    }
    if (tag === 'a') {
      const href = safeHref(match[3]);
      out += href ? `<a href="${href}" target="_blank" rel="noopener noreferrer nofollow">` : '<a>';
    } else {
      out += `<${tag}>`;
    }
    open.push(tag);
  }
  out += escapeText(html.slice(last));
  while (open.length) out += `</${open.pop()}>`;
  return out;
}
