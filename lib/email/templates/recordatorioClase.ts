/**
 * Plantilla_Default del tipo `recordatorio_clase` (es/en).
 *
 * Dirigida al ALUMNO: recordatorio manual enviado por su profesor o admin
 * sobre una clase agendada. Incluye todos los detalles de la clase y un botón
 * para verla en la plataforma.
 *
 * Esta plantilla se usa tanto para el envío automático al asignar una clase
 * (si el usuario tiene habilitado `enviar_correo_al_asignar`) como para el
 * envío manual mediante el botón de recordatorio en el detalle de la clase.
 */

import type { ContenidoPlantilla, IdiomaCorreo } from '../types';
import { renderLayout, renderBoton } from './layout';

const cuerpoEs = renderLayout({
  idioma: 'es',
  preheader: 'Recordatorio de tu próxima clase.',
  contenidoHtml: `
<p style="margin:0 0 16px 0;">Hola <strong>{nombre_destinatario}</strong>,</p>
<p style="margin:0 0 16px 0;">Te recordamos que tienes una <strong>clase agendada</strong>. A continuación los detalles:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px 0;border-collapse:collapse;">
<tr><td style="padding:6px 0;color:#7b8794;width:120px;vertical-align:top;">Clase</td><td style="padding:6px 0;font-weight:bold;">{titulo_clase}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;vertical-align:top;">Descripción</td><td style="padding:6px 0;">{descripcion_clase}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Fecha</td><td style="padding:6px 0;">{fecha}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Horario</td><td style="padding:6px 0;">{hora_inicio} - {hora_fin}</td></tr>
</table>
<p style="margin:0 0 20px 0;font-size:14px;color:#7b8794;">Si necesitas hacer algún cambio, comunícate con tu profesor.</p>
${renderBoton({ href: '{enlace_clase}', texto: 'Ver la clase' })}
`,
});

const cuerpoEn = renderLayout({
  idioma: 'en',
  preheader: 'Reminder about your upcoming class.',
  contenidoHtml: `
<p style="margin:0 0 16px 0;">Hello <strong>{nombre_destinatario}</strong>,</p>
<p style="margin:0 0 16px 0;">This is a reminder that you have a <strong>scheduled class</strong>. Here are the details:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px 0;border-collapse:collapse;">
<tr><td style="padding:6px 0;color:#7b8794;width:120px;vertical-align:top;">Class</td><td style="padding:6px 0;font-weight:bold;">{titulo_clase}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;vertical-align:top;">Description</td><td style="padding:6px 0;">{descripcion_clase}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Date</td><td style="padding:6px 0;">{fecha}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Time</td><td style="padding:6px 0;">{hora_inicio} - {hora_fin}</td></tr>
</table>
<p style="margin:0 0 20px 0;font-size:14px;color:#7b8794;">If you need to make any changes, please contact your teacher.</p>
${renderBoton({ href: '{enlace_clase}', texto: 'View class' })}
`,
});

/** Plantilla_Default de `recordatorio_clase` por idioma. */
export const plantilla: Record<IdiomaCorreo, ContenidoPlantilla> = {
  es: {
    asunto: 'Recordatorio de clase: {titulo_clase}',
    cuerpoHtml: cuerpoEs,
  },
  en: {
    asunto: 'Class reminder: {titulo_clase}',
    cuerpoHtml: cuerpoEn,
  },
};
