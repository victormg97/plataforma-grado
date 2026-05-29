/**
 * Plantilla_Default del tipo `solicitud_cambio_horario` (es/en).
 *
 * Dirigida al profesor propietario del horario ({nombre_destinatario}): informa
 * de que el alumno {nombre_alumno} solicitó un cambio de horario para la clase
 * {titulo_clase} (originalmente del {fecha}, de {hora_inicio} a {hora_fin}) y
 * detalla el horario propuesto: {fecha_propuesta}, de {hora_inicio_propuesta} a
 * {hora_fin_propuesta}, junto con la nota del alumno {nota_alumno}.
 *
 * Exporta `plantilla: Record<IdiomaCorreo, ContenidoPlantilla>` con asunto no
 * vacío (1–200 caracteres) y cuerpo HTML no vacío para cada idioma, envuelto en el
 * layout común del tenant (Requisito 3.1, 3.3, 3.4, 3.5, 15.5). Los tokens de
 * Variables_Dinamicas se sustituyen después con `sustituirVariables`; si algún
 * token queda vacío, el correo sigue siendo HTML válido.
 */

import type { ContenidoPlantilla, IdiomaCorreo } from '../types';
import { renderLayout } from './layout';

const cuerpoEs = renderLayout({
  idioma: 'es',
  preheader: 'Un alumno solicitó un cambio de horario.',
  contenidoHtml: `
<p style="margin:0 0 16px 0;">Hola <strong>{nombre_destinatario}</strong>,</p>
<p style="margin:0 0 16px 0;">El alumno <strong>{nombre_alumno}</strong> ha <strong>solicitado un cambio de horario</strong> para la clase <strong>{titulo_clase}</strong>.</p>
<p style="margin:0 0 8px 0;color:#7b8794;font-weight:bold;">Horario actual</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px 0;border-collapse:collapse;">
<tr><td style="padding:6px 0;color:#7b8794;width:140px;">Fecha</td><td style="padding:6px 0;">{fecha}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Horario</td><td style="padding:6px 0;">{hora_inicio} - {hora_fin}</td></tr>
</table>
<p style="margin:0 0 8px 0;color:#7b8794;font-weight:bold;">Horario propuesto</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px 0;border-collapse:collapse;">
<tr><td style="padding:6px 0;color:#7b8794;width:140px;">Fecha propuesta</td><td style="padding:6px 0;font-weight:bold;">{fecha_propuesta}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Horario propuesto</td><td style="padding:6px 0;font-weight:bold;">{hora_inicio_propuesta} - {hora_fin_propuesta}</td></tr>
</table>
<p style="margin:0 0 6px 0;color:#7b8794;font-weight:bold;">Nota del alumno</p>
<p style="margin:0 0 24px 0;padding:12px 16px;background-color:#f4f5f7;border-radius:6px;">{nota_alumno}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px 0;"><tr><td style="border-radius:6px;background-color:#1f2933;">
<a href="{enlace_clase}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">Revisar la solicitud</a>
</td></tr></table>
`,
});

const cuerpoEn = renderLayout({
  idioma: 'en',
  preheader: 'A student requested a schedule change.',
  contenidoHtml: `
<p style="margin:0 0 16px 0;">Hello <strong>{nombre_destinatario}</strong>,</p>
<p style="margin:0 0 16px 0;">The student <strong>{nombre_alumno}</strong> has <strong>requested a schedule change</strong> for the class <strong>{titulo_clase}</strong>.</p>
<p style="margin:0 0 8px 0;color:#7b8794;font-weight:bold;">Current schedule</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px 0;border-collapse:collapse;">
<tr><td style="padding:6px 0;color:#7b8794;width:160px;">Date</td><td style="padding:6px 0;">{fecha}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Time</td><td style="padding:6px 0;">{hora_inicio} - {hora_fin}</td></tr>
</table>
<p style="margin:0 0 8px 0;color:#7b8794;font-weight:bold;">Proposed schedule</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px 0;border-collapse:collapse;">
<tr><td style="padding:6px 0;color:#7b8794;width:160px;">Proposed date</td><td style="padding:6px 0;font-weight:bold;">{fecha_propuesta}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Proposed time</td><td style="padding:6px 0;font-weight:bold;">{hora_inicio_propuesta} - {hora_fin_propuesta}</td></tr>
</table>
<p style="margin:0 0 6px 0;color:#7b8794;font-weight:bold;">Student's note</p>
<p style="margin:0 0 24px 0;padding:12px 16px;background-color:#f4f5f7;border-radius:6px;">{nota_alumno}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px 0;"><tr><td style="border-radius:6px;background-color:#1f2933;">
<a href="{enlace_clase}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">Review request</a>
</td></tr></table>
`,
});

/** Plantilla_Default de `solicitud_cambio_horario` por idioma (Requisito 3.1, 3.5, 15.5). */
export const plantilla: Record<IdiomaCorreo, ContenidoPlantilla> = {
  es: {
    asunto: 'Solicitud de cambio de horario: {titulo_clase}',
    cuerpoHtml: cuerpoEs,
  },
  en: {
    asunto: 'Schedule change request: {titulo_clase}',
    cuerpoHtml: cuerpoEn,
  },
};
