/**
 * Plantilla_Default del tipo `nueva_simulacion` (es/en).
 *
 * Dirigida al ALUMNO ({nombre_destinatario}): informa de que se le ha agendado
 * una Simulación de Examen de Grado, incluyendo la fecha, hora, comisión
 * evaluadora y enlace de conexión.
 *
 * Variables dinámicas:
 * - {nombre_destinatario}   — nombre del alumno receptor
 * - {nombre_alumno}         — nombre del alumno (same as destinatario)
 * - {titulo_clase}          — título de la simulación
 * - {descripcion_clase}     — descripción (puede estar vacía)
 * - {fecha}                 — fecha formateada
 * - {hora_inicio}           — hora de inicio
 * - {hora_fin}              — hora de fin
 * - {comision_profesores}   — lista de profesores de la comisión evaluadora
 * - {enlace_conexion}       — URL de la reunión (puede estar vacío)
 * - {enlace_clase}          — enlace a la clase en la plataforma
 *
 * Exporta `plantilla: Record<IdiomaCorreo, ContenidoPlantilla>` con asunto no
 * vacío (1–200 caracteres) y cuerpo HTML no vacío para cada idioma, envuelto en el
 * layout común del tenant. Los tokens de Variables_Dinamicas se sustituyen después
 * con `sustituirVariables`; si los campos opcionales ({enlace_conexion}) quedan
 * vacíos, el correo sigue siendo HTML válido.
 */

import type { ContenidoPlantilla, IdiomaCorreo } from '../types';
import { renderLayout, renderBoton } from './layout';

const cuerpoEs = renderLayout({
  idioma: 'es',
  preheader: 'Se ha agendado una Simulación de Examen de Grado para ti.',
  contenidoHtml: `
<p style="margin:0 0 16px 0;">Hola <strong>{nombre_destinatario}</strong>,</p>
<p style="margin:0 0 16px 0;">Se ha agendado una <strong>Simulación de Examen de Grado</strong> para ti. A continuación los detalles:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px 0;border-collapse:collapse;">
<tr><td style="padding:6px 0;color:#7b8794;width:140px;vertical-align:top;">Simulación</td><td style="padding:6px 0;font-weight:bold;">{titulo_clase}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;vertical-align:top;">Descripción</td><td style="padding:6px 0;">{descripcion_clase}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Fecha</td><td style="padding:6px 0;">{fecha}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Horario</td><td style="padding:6px 0;">{hora_inicio} - {hora_fin}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;vertical-align:top;">Comisión evaluadora</td><td style="padding:6px 0;">{comision_profesores}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Enlace de conexión</td><td style="padding:6px 0;">{enlace_conexion}</td></tr>
</table>
<p style="margin:0 0 24px 0;font-size:14px;color:#5a6a78;">Prepárate bien para esta instancia. La comisión evaluadora te realizará preguntas de sus respectivas materias.</p>
${renderBoton({ href: '{enlace_clase}', texto: 'Ver simulación' })}
`,
});

const cuerpoEn = renderLayout({
  idioma: 'en',
  preheader: 'A Mock Bar Exam simulation has been scheduled for you.',
  contenidoHtml: `
<p style="margin:0 0 16px 0;">Hello <strong>{nombre_destinatario}</strong>,</p>
<p style="margin:0 0 16px 0;">A <strong>Mock Bar Exam Simulation</strong> has been scheduled for you. Here are the details:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px 0;border-collapse:collapse;">
<tr><td style="padding:6px 0;color:#7b8794;width:140px;vertical-align:top;">Simulation</td><td style="padding:6px 0;font-weight:bold;">{titulo_clase}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;vertical-align:top;">Description</td><td style="padding:6px 0;">{descripcion_clase}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Date</td><td style="padding:6px 0;">{fecha}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Time</td><td style="padding:6px 0;">{hora_inicio} - {hora_fin}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;vertical-align:top;">Evaluation commission</td><td style="padding:6px 0;">{comision_profesores}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Meeting link</td><td style="padding:6px 0;">{enlace_conexion}</td></tr>
</table>
<p style="margin:0 0 24px 0;font-size:14px;color:#5a6a78;">Make sure to prepare well for this session. The evaluation commission will ask questions from their respective subjects.</p>
${renderBoton({ href: '{enlace_clase}', texto: 'View simulation' })}
`,
});

/** Plantilla_Default de `nueva_simulacion` por idioma. */
export const plantilla: Record<IdiomaCorreo, ContenidoPlantilla> = {
  es: {
    asunto: 'Simulación de Examen agendada: {titulo_clase}',
    cuerpoHtml: cuerpoEs,
  },
  en: {
    asunto: 'Exam Simulation scheduled: {titulo_clase}',
    cuerpoHtml: cuerpoEn,
  },
};
