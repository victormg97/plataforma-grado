/**
 * Utilidad de truncado dinámico de notas de clase para correos.
 *
 * Cuando un profesor o admin deja una nota/feedback en una clase, el correo al
 * alumno incluye un extracto de la nota para dar contexto, pero se trunca de
 * forma inteligente para incentivar al alumno a entrar a la plataforma y ver
 * la nota completa.
 *
 * El truncado es DINÁMICO: notas cortas se muestran completas, notas largas se
 * recortan proporcionalmente. El límite por defecto es generoso pero deja claro
 * que hay más contenido por ver.
 *
 * El admin/profesor puede configurar el límite máximo de caracteres mediante la
 * variable `max_caracteres_nota` en la plantilla personalizada. Si se establece
 * en `0` o un valor muy alto, se muestra la nota completa.
 */

/** Caracteres por defecto para el truncado dinámico de notas en correos. */
export const DEFAULT_MAX_CHARS_NOTA = 600;

/**
 * Indicador de truncado que se añade al final del extracto para señalar que
 * hay más contenido.
 */
const ELLIPSIS_ES = '…';

/**
 * Calcula dinámicamente el límite de truncado basado en la longitud de la nota.
 *
 * Lógica:
 * - Notas ≤ maxChars: se muestran completas (sin truncar).
 * - Notas > maxChars: se truncan al `maxChars` respetando los límites de palabra.
 *
 * El `maxChars` por defecto (600) es generoso: muestra suficiente contexto para
 * que el alumno entienda el feedback, pero incentiva a entrar a la plataforma
 * para ver la nota completa con formato, si es más larga.
 *
 * @param contenidoHtml Contenido HTML de la nota (puede tener tags).
 * @param maxChars Máximo de caracteres visibles (texto plano) antes de truncar.
 *                 Si es `0` o negativo, se muestra la nota completa.
 * @returns Objeto con el HTML truncado (o completo) y si fue truncada.
 */
export function truncateNoteForEmail(
  contenidoHtml: string,
  maxChars: number = DEFAULT_MAX_CHARS_NOTA,
): { html: string; wasTruncated: boolean } {
  if (!contenidoHtml || !contenidoHtml.trim()) {
    return { html: '', wasTruncated: false };
  }

  // Si maxChars es 0 o negativo, mostrar completo (opción del admin)
  if (maxChars <= 0) {
    return { html: contenidoHtml, wasTruncated: false };
  }

  // Extraer texto plano para medir la longitud real visible
  const plainText = contenidoHtml
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  // Si el texto plano es más corto que el límite, mostrar completo
  if (plainText.length <= maxChars) {
    return { html: contenidoHtml, wasTruncated: false };
  }

  // Truncar respetando límites de palabra en el texto plano
  let truncateAt = maxChars;

  // Retroceder hasta encontrar un espacio para no cortar palabras
  while (truncateAt > maxChars * 0.8 && plainText[truncateAt] !== ' ') {
    truncateAt--;
  }

  // Si no encontramos espacio en un rango razonable, cortar en el límite
  if (truncateAt <= maxChars * 0.8) {
    truncateAt = maxChars;
  }

  const truncatedPlain = plainText.slice(0, truncateAt).trim();

  // Reconstruir como HTML simple (párrafos del texto truncado)
  // Usamos el texto plano truncado para evitar tags HTML rotos/abiertos
  const truncatedHtml = `<p style="margin:0;">${truncatedPlain}${ELLIPSIS_ES}</p>`;

  return { html: truncatedHtml, wasTruncated: true };
}
