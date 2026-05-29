/**
 * Plantilla_Default del tipo `programa_asignado` (es/en).
 *
 * Dirigida al ALUMNO ({nombre_destinatario}): informa de que su profesor le
 * asignó un nuevo programa de clases. Puede incluir un enlace directo a la clase
 * mediante {enlace_clase}.
 *
 * Exporta `plantilla: Record<IdiomaCorreo, ContenidoPlantilla>` con asunto no
 * vacío (1–200 caracteres) y cuerpo HTML no vacío para cada idioma, envuelto en el
 * layout común del tenant (Requisito 3.1, 3.3, 3.4, 3.5). Los tokens de
 * Variables_Dinamicas se sustituyen después con `sustituirVariables`; si
 * `{enlace_clase}` queda vacío, el correo sigue siendo HTML válido.
 */

import type { ContenidoPlantilla, IdiomaCorreo } from '../types';
import { renderLayout } from './layout';

const cuerpoEs = renderLayout({
  idioma: 'es',
  preheader: 'Tu profesor te asignó un nuevo programa de clases.',
  contenidoHtml: `
<p style="margin:0 0 16px 0;">Hola <strong>{nombre_destinatario}</strong>,</p>
<p style="margin:0 0 16px 0;">Tu profesor te ha <strong>asignado un nuevo programa de clases</strong>. Ya puedes consultar tu plan y prepararte para tus próximas sesiones.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px 0;border-collapse:collapse;">
<tr><td style="padding:6px 0;color:#7b8794;width:120px;">Clase</td><td style="padding:6px 0;font-weight:bold;">{titulo_clase}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Fecha</td><td style="padding:6px 0;">{fecha}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Horario</td><td style="padding:6px 0;">{hora_inicio} - {hora_fin}</td></tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px 0;"><tr><td style="border-radius:6px;background-color:#1f2933;">
<a href="{enlace_clase}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">Ver mi programa</a>
</td></tr></table>
`,
});

const cuerpoEn = renderLayout({
  idioma: 'en',
  preheader: 'Your teacher assigned you a new class program.',
  contenidoHtml: `
<p style="margin:0 0 16px 0;">Hello <strong>{nombre_destinatario}</strong>,</p>
<p style="margin:0 0 16px 0;">Your teacher has <strong>assigned you a new class program</strong>. You can now review your plan and get ready for your upcoming sessions.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px 0;border-collapse:collapse;">
<tr><td style="padding:6px 0;color:#7b8794;width:120px;">Class</td><td style="padding:6px 0;font-weight:bold;">{titulo_clase}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Date</td><td style="padding:6px 0;">{fecha}</td></tr>
<tr><td style="padding:6px 0;color:#7b8794;">Time</td><td style="padding:6px 0;">{hora_inicio} - {hora_fin}</td></tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px 0;"><tr><td style="border-radius:6px;background-color:#1f2933;">
<a href="{enlace_clase}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">View my program</a>
</td></tr></table>
`,
});

/** Plantilla_Default de `programa_asignado` por idioma (Requisito 3.1, 3.5). */
export const plantilla: Record<IdiomaCorreo, ContenidoPlantilla> = {
  es: {
    asunto: 'Nuevo programa de clases asignado',
    cuerpoHtml: cuerpoEs,
  },
  en: {
    asunto: 'New class program assigned',
    cuerpoHtml: cuerpoEn,
  },
};
