/**
 * Plantilla_Default del tipo `bienvenida_registro` (es/en).
 *
 * Se envía cuando un usuario completa su propio registro mediante un enlace de
 * invitación (`/api/registro`). A diferencia de `invitacion_acceso`, en este flujo
 * el usuario ya eligió su contraseña y ya tiene sesión activa, por lo que no hay
 * ningún paso pendiente: el correo es pura bienvenida.
 *
 * Variables disponibles:
 *   - `{nombre_destinatario}`: nombre completo de quien se registró.
 *   - `{descripcion_acceso}`: párrafo corto adaptado al rol (alumno, profesor,
 *     lector) que describe qué puede hacer en la plataforma. Lo aporta el punto
 *     de disparo (`api/registro/route.ts`) según `tipo` del enlace.
 *
 * Tono: cálido, neutro en género, elegante. Sin pasos ni botones de acción:
 * el usuario ya está adentro.
 */

import type { ContenidoPlantilla, IdiomaCorreo } from '../types';
import { renderLayout } from './layout';
import { tenantConfig } from '@/config';

// ─── Descripciones de acceso por rol (es) ────────────────────────────────────
// Se usan como valor de la variable {descripcion_acceso} al llamar al servicio.
// Se exportan para que el punto de disparo las use directamente.

export const DESCRIPCION_ACCESO_ES: Record<'alumno' | 'profesor' | 'lector', string> = {
  alumno: `En la plataforma encontrarás todo lo que necesitas para prepararte y rendir tu examen de grado: tus clases agendadas, el historial de sesiones, archivos de estudio compartidos por tus profesores y la posibilidad de hacer seguimiento a tu proceso en cada etapa.`,
  profesor: `Desde tu panel podrás gestionar tus clases, registrar la asistencia de tus alumnos, compartir archivos de estudio y hacer seguimiento al avance de cada persona a tu cargo.`,
  lector: `Tu acceso te permite explorar la biblioteca de archivos de estudio compartidos en la plataforma, pensados para apoyar la preparación hacia el examen de grado.`,
};

export const DESCRIPCION_ACCESO_EN: Record<'alumno' | 'profesor' | 'lector', string> = {
  alumno: `On the platform you will find everything you need to prepare for and take your degree exam: your scheduled sessions, class history, study files shared by your professors, and the ability to track your progress at every stage.`,
  profesor: `From your dashboard you can manage your classes, record student attendance, share study materials, and monitor the progress of each person in your care.`,
  lector: `Your access lets you explore the library of study files shared on the platform, designed to support preparation for the degree exam.`,
};

// ─── Cuerpo HTML (es) ─────────────────────────────────────────────────────────

const cuerpoEs = renderLayout({
  idioma: 'es',
  preheader: `Bienvenida/o a ${tenantConfig.nombre} — ya puedes acceder a la plataforma.`,
  contenidoHtml: `
<p style="margin:0 0 16px 0;">Hola <strong>{nombre_destinatario}</strong>,</p>
<p style="margin:0 0 16px 0;">
  Tu cuenta en <strong>${tenantConfig.nombre}</strong> está lista.
  A partir de ahora puedes iniciar sesión en cualquier momento con el correo
  y la contraseña que registraste.
</p>
<p style="margin:0 0 8px 0;font-weight:bold;color:#1f2933;">¿Qué puedes hacer aquí?</p>
<p style="margin:0 0 24px 0;color:#3e4c59;">{descripcion_acceso}</p>
<p style="margin:0 0 0 0;font-size:13px;color:#7b8794;">
  Si tienes alguna duda, escríbenos y con gusto te ayudamos.
</p>
`,
});

// ─── Cuerpo HTML (en) ─────────────────────────────────────────────────────────

const cuerpoEn = renderLayout({
  idioma: 'en',
  preheader: `Welcome to ${tenantConfig.nombre} — your account is ready.`,
  contenidoHtml: `
<p style="margin:0 0 16px 0;">Hello <strong>{nombre_destinatario}</strong>,</p>
<p style="margin:0 0 16px 0;">
  Your account on <strong>${tenantConfig.nombre}</strong> is ready.
  From now on you can sign in at any time with the email and password you registered.
</p>
<p style="margin:0 0 8px 0;font-weight:bold;color:#1f2933;">What can you do here?</p>
<p style="margin:0 0 24px 0;color:#3e4c59;">{descripcion_acceso}</p>
<p style="margin:0 0 0 0;font-size:13px;color:#7b8794;">
  If you have any questions, feel free to reach out — we are happy to help.
</p>
`,
});

/** Plantilla_Default de `bienvenida_registro` por idioma. */
export const plantilla: Record<IdiomaCorreo, ContenidoPlantilla> = {
  es: {
    asunto: `Bienvenida/o a ${tenantConfig.nombre} — tu cuenta está lista`,
    cuerpoHtml: cuerpoEs,
  },
  en: {
    asunto: `Welcome to ${tenantConfig.nombre} — your account is ready`,
    cuerpoHtml: cuerpoEn,
  },
};
