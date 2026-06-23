/**
 * Plantilla_Default del tipo `nueva_nota_clase` (es/en).
 *
 * Dirigida al ALUMNO: informa de que se dejó una nota en su clase.
 * El correo incluye el contenido de la nota destacado, datos de la clase
 * y un botón para ir directamente a verla.
 *
 * Lenguaje género-neutral, formal pero cercano.
 */

import type { ContenidoPlantilla, IdiomaCorreo } from '../types';
import { renderLayout, renderBoton } from './layout';

const cuerpoEs = renderLayout({
  idioma: 'es',
  preheader: 'Tienes una nueva nota en tu clase.',
  contenidoHtml: `
<p style="margin:0 0 16px 0;">Hola <strong>{nombre_destinatario}</strong>,</p>
<p style="margin:0 0 16px 0;">{nombre_autor} ha dejado una <strong>nota</strong> en la clase <strong>{titulo_clase}</strong> del {fecha} ({hora_inicio} - {hora_fin}):</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px 0;">
<tr>
<td style="padding:16px 20px;background-color:#f8f5f0;border-left:4px solid #c9993f;border-radius:4px;font-size:14px;line-height:1.6;color:#1f2933;">
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
<td style="padding:16px 20px;background-color:#f8f5f0;border-left:4px solid #c9993f;border-radius:4px;font-size:14px;line-height:1.6;color:#1f2933;">
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
