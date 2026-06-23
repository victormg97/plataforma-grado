/**
 * Plantilla_Default del tipo `nueva_nota_clase` (es/en).
 *
 * Dirigida al ALUMNO: informa de que se dejó una nota en su clase.
 * El correo incluye el contenido de la nota destacado, datos de la clase
 * y un botón para ir directamente a verla.
 *
 * Lenguaje género-neutral, formal pero cercano.
 * Usa los colores de marca del tenant (nunca colores hardcoded).
 */

import { tenantConfig } from '@/config';
import type { ContenidoPlantilla, IdiomaCorreo } from '../types';
import { renderLayout, renderBoton } from './layout';

// Color de marca del tenant para el borde lateral de la nota
const COLOR_ACENTO = tenantConfig.theme.colorAccent;

/**
 * Derives a light tint from the tenant accent color for the note background.
 * Mixes 10% of accent with white — compatible with all email clients
 * (uses computed hex, not CSS color-mix which has poor email support).
 */
function tintFromHex(hex: string, amount = 0.1): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const tr = Math.round(r + (255 - r) * (1 - amount));
  const tg = Math.round(g + (255 - g) * (1 - amount));
  const tb = Math.round(b + (255 - b) * (1 - amount));
  return `#${tr.toString(16).padStart(2, '0')}${tg.toString(16).padStart(2, '0')}${tb.toString(16).padStart(2, '0')}`;
}

const FONDO_NOTA = tintFromHex(COLOR_ACENTO, 0.08);

const cuerpoEs = renderLayout({
  idioma: 'es',
  preheader: 'Tienes una nueva nota en tu clase.',
  contenidoHtml: `
<p style="margin:0 0 16px 0;">Hola <strong>{nombre_destinatario}</strong>,</p>
<p style="margin:0 0 16px 0;">{nombre_autor} ha dejado una <strong>nota</strong> en la clase <strong>{titulo_clase}</strong> del {fecha} ({hora_inicio} - {hora_fin}):</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px 0;">
<tr>
<td style="padding:16px 20px;background-color:${FONDO_NOTA};border-left:4px solid ${COLOR_ACENTO};border-radius:4px;font-size:14px;line-height:1.6;color:#1f2933;">
{contenido_nota}
</td>
</tr>
</table>
<p style="margin:0 0 20px 0;font-size:14px;color:#7b8794;">Puedes ver la nota completa y responder desde la plataforma.</p>
${renderBoton({ href: '{enlace_clase}', texto: 'Ver la nota' })}
`,
});

const cuerpoEn = renderLayout({
  idioma: 'en',
  preheader: 'You have a new note on your class.',
  contenidoHtml: `
<p style="margin:0 0 16px 0;">Hello <strong>{nombre_destinatario}</strong>,</p>
<p style="margin:0 0 16px 0;">{nombre_autor} left a <strong>note</strong> on your class <strong>{titulo_clase}</strong> on {fecha} ({hora_inicio} - {hora_fin}):</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px 0;">
<tr>
<td style="padding:16px 20px;background-color:${FONDO_NOTA};border-left:4px solid ${COLOR_ACENTO};border-radius:4px;font-size:14px;line-height:1.6;color:#1f2933;">
{contenido_nota}
</td>
</tr>
</table>
<p style="margin:0 0 20px 0;font-size:14px;color:#7b8794;">You can view the full note and reply from the platform.</p>
${renderBoton({ href: '{enlace_clase}', texto: 'View note' })}
`,
});

/** Plantilla_Default de `nueva_nota_clase` por idioma. */
export const plantilla: Record<IdiomaCorreo, ContenidoPlantilla> = {
  es: {
    asunto: 'Nueva nota en tu clase: {titulo_clase}',
    cuerpoHtml: cuerpoEs,
  },
  en: {
    asunto: 'New note on your class: {titulo_clase}',
    cuerpoHtml: cuerpoEn,
  },
};
