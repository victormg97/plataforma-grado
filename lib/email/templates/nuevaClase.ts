/**
 * Plantilla_Default del tipo `nueva_clase` (es/en).
 *
 * Dirigida al ALUMNO ({nombre_destinatario}): informa de que su profesor le
 * agendó una nueva clase singular {titulo_clase} ({descripcion_clase}) del
 * {fecha}, de {hora_inicio} a {hora_fin}, e incluye un botón con el color de marca
 * que enlaza a la clase mediante {enlace_clase}.
 *
 * Exporta `plantilla: Record<IdiomaCorreo, ContenidoPlantilla>` con asunto no
 * vacío (1–200 caracteres) y cuerpo HTML no vacío para cada idioma, envuelto en el
 * layout común del tenant. Los tokens de Variables_Dinamicas se sustituyen después
 * con `sustituirVariables`; si `{descripcion_clase}` o `{enlace_clase}` quedan
 * vacíos, el correo sigue siendo HTML válido.
 */

import type { ContenidoPlantilla, IdiomaCorreo } from '../types';
import { renderLayout, renderBoton } from './layout';

const cuerpoEs = renderLayout({
  idioma: 'es',
  preheader: 'Tu profesor te agendó una nueva clase.',
  contenidoHtml: `
<p style="margin:0 0 16px 0;">Hola <strong>{nombre_destinatario}</strong>,</p>
<p style="margin:0 0 16px 0;">Tu profesor te ha <strong>agendado una nueva clase</strong>. A continuación tienes los detalles:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px 0;border-collapse:collapse;">
<tr><td style="padding:6px 0;color:#7b8794;width:120px;vertical-align:top;">Clase</td><td style="padding:6px 0;font-weight:bold;">{titulo_clase}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;vertical-align:top;">Descripción</td><td style="padding:6px 0;">{descripcion_clase}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Fecha</td><td style="padding:6px 0;">{fecha}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Horario</td><td style="padding:6px 0;">{hora_inicio} - {hora_fin}</td></tr>
</table>
${renderBoton({ href: '{enlace_clase}', texto: 'Ver la clase' })}
`,
});

const cuerpoEn = renderLayout({
  idioma: 'en',
  preheader: 'Your teacher scheduled a new class for you.',
  contenidoHtml: `
<p style="margin:0 0 16px 0;">Hello <strong>{nombre_destinatario}</strong>,</p>
<p style="margin:0 0 16px 0;">Your teacher has <strong>scheduled a new class</strong> for you. Here are the details:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px 0;border-collapse:collapse;">
<tr><td style="padding:6px 0;color:#7b8794;width:120px;vertical-align:top;">Class</td><td style="padding:6px 0;font-weight:bold;">{titulo_clase}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;vertical-align:top;">Description</td><td style="padding:6px 0;">{descripcion_clase}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Date</td><td style="padding:6px 0;">{fecha}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Time</td><td style="padding:6px 0;">{hora_inicio} - {hora_fin}</td></tr>
</table>
${renderBoton({ href: '{enlace_clase}', texto: 'View class' })}
`,
});

/** Plantilla_Default de `nueva_clase` por idioma. */
export const plantilla: Record<IdiomaCorreo, ContenidoPlantilla> = {
  es: {
    asunto: 'Nueva clase agendada: {titulo_clase}',
    cuerpoHtml: cuerpoEs,
  },
  en: {
    asunto: 'New class scheduled: {titulo_clase}',
    cuerpoHtml: cuerpoEn,
  },
};
