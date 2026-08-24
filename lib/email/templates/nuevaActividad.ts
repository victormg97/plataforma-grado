/**
 * Plantilla_Default del tipo `nueva_actividad` (es/en).
 *
 * Dirigida al ALUMNO ({nombre_destinatario}): informa de que un profesor o
 * administrador le agendó una nueva actividad (master class, charla, evento
 * externo, etc.) con los detalles de fecha, hora, lugar y enlace de conexión.
 *
 * Variables dinámicas (Requisito 13.6):
 * - {nombre_destinatario}  — nombre del alumno receptor
 * - {titulo_actividad}     — título de la actividad
 * - {categoria}            — etiqueta de categoría traducida al idioma del perfil
 * - {fecha}                — fecha formateada según el idioma del perfil
 * - {hora_inicio}          — hora de inicio (o etiqueta de día completo)
 * - {hora_fin}             — hora de fin (o etiqueta de día completo)
 * - {lugar}                — lugar (vacío si no hay)
 * - {enlace_conexion}      — URL de reunión en línea (vacío si no hay)
 * - {enlace_agenda}        — URL absoluta a la agenda del alumno
 *
 * Exporta `plantilla: Record<IdiomaCorreo, ContenidoPlantilla>` con asunto no
 * vacío (1–200 caracteres) y cuerpo HTML no vacío para cada idioma, envuelto en el
 * layout común del tenant. Los tokens de Variables_Dinamicas se sustituyen después
 * con `sustituirVariables`; si los campos opcionales ({lugar}, {enlace_conexion})
 * quedan vacíos, el correo sigue siendo HTML válido.
 *
 * _Requisitos: 13.5, 13.6, 13.7, 16.6_
 */

import type { ContenidoPlantilla, IdiomaCorreo } from '../types';
import { renderLayout, renderBoton } from './layout';

const cuerpoEs = renderLayout({
  idioma: 'es',
  preheader: 'Se agendó una nueva actividad para ti.',
  contenidoHtml: `
<p style="margin:0 0 16px 0;">Hola <strong>{nombre_destinatario}</strong>,</p>
<p style="margin:0 0 16px 0;">Se ha agendado una <strong>nueva actividad</strong> para ti. A continuación tienes los detalles:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px 0;border-collapse:collapse;">
<tr><td style="padding:6px 0;color:#7b8794;width:130px;vertical-align:top;">Actividad</td><td style="padding:6px 0;font-weight:bold;">{titulo_actividad}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;vertical-align:top;">Categoría</td><td style="padding:6px 0;">{categoria}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Fecha</td><td style="padding:6px 0;">{fecha}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Horario</td><td style="padding:6px 0;">{hora_inicio} - {hora_fin}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Lugar</td><td style="padding:6px 0;">{lugar}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Enlace de conexión</td><td style="padding:6px 0;">{enlace_conexion}</td></tr>
</table>
${renderBoton({ href: '{enlace_agenda}', texto: 'Ver mi agenda' })}
`,
});

const cuerpoEn = renderLayout({
  idioma: 'en',
  preheader: 'A new activity has been scheduled for you.',
  contenidoHtml: `
<p style="margin:0 0 16px 0;">Hello <strong>{nombre_destinatario}</strong>,</p>
<p style="margin:0 0 16px 0;">A <strong>new activity</strong> has been scheduled for you. Here are the details:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px 0;border-collapse:collapse;">
<tr><td style="padding:6px 0;color:#7b8794;width:130px;vertical-align:top;">Activity</td><td style="padding:6px 0;font-weight:bold;">{titulo_actividad}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;vertical-align:top;">Category</td><td style="padding:6px 0;">{categoria}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Date</td><td style="padding:6px 0;">{fecha}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Time</td><td style="padding:6px 0;">{hora_inicio} - {hora_fin}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Location</td><td style="padding:6px 0;">{lugar}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Meeting link</td><td style="padding:6px 0;">{enlace_conexion}</td></tr>
</table>
${renderBoton({ href: '{enlace_agenda}', texto: 'View my schedule' })}
`,
});

/** Plantilla_Default de `nueva_actividad` por idioma (Requisitos 13.5, 13.7, 16.6). */
export const plantilla: Record<IdiomaCorreo, ContenidoPlantilla> = {
  es: {
    asunto: 'Nueva actividad agendada: {titulo_actividad}',
    cuerpoHtml: cuerpoEs,
  },
  en: {
    asunto: 'New activity scheduled: {titulo_actividad}',
    cuerpoHtml: cuerpoEn,
  },
};
