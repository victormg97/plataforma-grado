/**
 * Plantilla_Default del tipo `confirmacion` (es/en).
 *
 * Dirigida al profesor propietario del horario ({nombre_destinatario}): informa
 * de que el alumno {nombre_alumno} confirmó su asistencia a la clase singular
 * {titulo_clase} ({descripcion_clase}) del {fecha}, de {hora_inicio} a {hora_fin}.
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
  preheader: 'Un alumno confirmó su asistencia a una clase.',
  contenidoHtml: `
<p style="margin:0 0 16px 0;">Hola <strong>{nombre_destinatario}</strong>,</p>
<p style="margin:0 0 16px 0;">Te informamos que el alumno <strong>{nombre_alumno}</strong> ha <strong>confirmado su asistencia</strong> a la siguiente clase:</p>
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
  preheader: 'A student confirmed their attendance to a class.',
  contenidoHtml: `
<p style="margin:0 0 16px 0;">Hello <strong>{nombre_destinatario}</strong>,</p>
<p style="margin:0 0 16px 0;">We are letting you know that the student <strong>{nombre_alumno}</strong> has <strong>confirmed their attendance</strong> to the following class:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px 0;border-collapse:collapse;">
<tr><td style="padding:6px 0;color:#7b8794;width:120px;vertical-align:top;">Class</td><td style="padding:6px 0;font-weight:bold;">{titulo_clase}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;vertical-align:top;">Description</td><td style="padding:6px 0;">{descripcion_clase}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Date</td><td style="padding:6px 0;">{fecha}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Time</td><td style="padding:6px 0;">{hora_inicio} - {hora_fin}</td></tr>
</table>
${renderBoton({ href: '{enlace_clase}', texto: 'View class' })}
`,
});

/** Plantilla_Default de `confirmacion` por idioma. */
export const plantilla: Record<IdiomaCorreo, ContenidoPlantilla> = {
  es: {
    asunto: 'Confirmación de asistencia: {titulo_clase}',
    cuerpoHtml: cuerpoEs,
  },
  en: {
    asunto: 'Attendance confirmed: {titulo_clase}',
    cuerpoHtml: cuerpoEn,
  },
};
