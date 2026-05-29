/**
 * Plantilla_Default del tipo `invitacion_acceso` (es/en).
 *
 * Dirigida a un usuario recién creado ({nombre_destinatario}): da la bienvenida,
 * explica que se ha creado una cuenta en la plataforma del tenant (cuyo nombre
 * aporta el layout común), indica que su correo de acceso es {email_acceso} e
 * incluye un botón/enlace destacado {enlace_acceso} (OBLIGATORIO en el cuerpo)
 * para configurar su contraseña e ingresar a la plataforma.
 *
 * A diferencia del resto de plantillas, NO usa variables de clase: solo
 * {nombre_destinatario}, {email_acceso} y {enlace_acceso} (Requisito 19.4).
 *
 * Exporta `plantilla: Record<IdiomaCorreo, ContenidoPlantilla>` con asunto no
 * vacío (1–200 caracteres) y cuerpo HTML no vacío para cada idioma, envuelto en el
 * layout común del tenant (Requisito 3.1, 3.3, 3.4, 19.5, 19.6). Los tokens de
 * Variables_Dinamicas se sustituyen después con `sustituirVariables`.
 */

import type { ContenidoPlantilla, IdiomaCorreo } from '../types';
import { renderLayout } from './layout';

const cuerpoEs = renderLayout({
  idioma: 'es',
  preheader: 'Configura tu acceso a la plataforma.',
  contenidoHtml: `
<p style="margin:0 0 16px 0;">Hola <strong>{nombre_destinatario}</strong>,</p>
<p style="margin:0 0 16px 0;">Te damos la bienvenida. Se ha creado una cuenta para ti en la plataforma y solo falta un paso para que puedas empezar a usarla.</p>
<p style="margin:0 0 24px 0;">Tu correo de acceso es:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px 0;border-collapse:collapse;">
<tr><td style="padding:6px 0;color:#7b8794;width:160px;">Correo de acceso</td><td style="padding:6px 0;font-weight:bold;">{email_acceso}</td></tr>
</table>
<p style="margin:0 0 24px 0;">Haz clic en el siguiente botón para establecer tu contraseña y acceder a la plataforma:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;"><tr><td style="border-radius:6px;background-color:#1f2933;">
<a href="{enlace_acceso}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">Configurar mi acceso</a>
</td></tr></table>
<p style="margin:0 0 8px 0;font-size:13px;color:#7b8794;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
<p style="margin:0 0 8px 0;font-size:13px;word-break:break-all;"><a href="{enlace_acceso}" style="color:#1f2933;">{enlace_acceso}</a></p>
`,
});

const cuerpoEn = renderLayout({
  idioma: 'en',
  preheader: 'Set up your access to the platform.',
  contenidoHtml: `
<p style="margin:0 0 16px 0;">Hello <strong>{nombre_destinatario}</strong>,</p>
<p style="margin:0 0 16px 0;">Welcome. An account has been created for you on the platform, and there is just one step left before you can start using it.</p>
<p style="margin:0 0 24px 0;">Your access email is:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px 0;border-collapse:collapse;">
<tr><td style="padding:6px 0;color:#7b8794;width:160px;">Access email</td><td style="padding:6px 0;font-weight:bold;">{email_acceso}</td></tr>
</table>
<p style="margin:0 0 24px 0;">Click the button below to set your password and access the platform:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;"><tr><td style="border-radius:6px;background-color:#1f2933;">
<a href="{enlace_acceso}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">Set up my access</a>
</td></tr></table>
<p style="margin:0 0 8px 0;font-size:13px;color:#7b8794;">If the button does not work, copy and paste this link into your browser:</p>
<p style="margin:0 0 8px 0;font-size:13px;word-break:break-all;"><a href="{enlace_acceso}" style="color:#1f2933;">{enlace_acceso}</a></p>
`,
});

/** Plantilla_Default de `invitacion_acceso` por idioma (Requisito 3.1, 19.5, 19.6). */
export const plantilla: Record<IdiomaCorreo, ContenidoPlantilla> = {
  es: {
    asunto: 'Bienvenido/a — Configura tu acceso',
    cuerpoHtml: cuerpoEs,
  },
  en: {
    asunto: 'Welcome — Set up your access',
    cuerpoHtml: cuerpoEn,
  },
};
