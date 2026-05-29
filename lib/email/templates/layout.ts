/**
 * Envoltorio HTML común de los correos transaccionales (`lib/email/templates/`).
 *
 * Todas las Plantillas_Default envuelven el cuerpo específico de su tipo con este
 * layout para producir un correo formal, completo y consistente: estructura HTML
 * válida con estilos en línea (compatibles con clientes de correo, sin clases CSS
 * externas ni Tailwind), cabecera con el nombre del tenant y un pie de página
 * formal con una nota de correo automático.
 *
 * La cabecera y el pie usan `tenantConfig.nombre` del tenant activo, de modo que
 * el nombre del tenant siempre aparece en el correo renderizado (Requisito 3.3).
 *
 * Este módulo solo ENVUELVE el contenido: los tokens de Variables_Dinamicas (p.ej.
 * `{nombre_destinatario}`, `{titulo_clase}`, `{enlace_clase}`) los aporta cada
 * plantilla en su `contenidoHtml` y los sustituye después `sustituirVariables`.
 */

import { tenantConfig } from '@/config';
import type { IdiomaCorreo } from '../types';

/** Opciones para construir el layout de un correo. */
export interface OpcionesLayout {
  /** Idioma del correo; determina los textos fijos del pie. */
  idioma: IdiomaCorreo;
  /** HTML del cuerpo específico del tipo de correo (ya con sus tokens `{...}`). */
  contenidoHtml: string;
  /**
   * Texto de previsualización (preheader) que algunos clientes muestran junto al
   * asunto en la bandeja de entrada. Se renderiza oculto. Opcional.
   */
  preheader?: string;
}

/** Nota de pie por idioma indicando que el correo es automático (Requisito 3.3). */
const NOTA_PIE: Record<IdiomaCorreo, string> = {
  es: 'Este es un correo automático, por favor no respondas a este mensaje.',
  en: 'This is an automated email, please do not reply to this message.',
};

/** Texto de derechos por idioma para el pie de página. */
function textoPie(idioma: IdiomaCorreo, nombreTenant: string): string {
  if (idioma === 'en') {
    return `You are receiving this email from ${nombreTenant}.`;
  }
  return `Estás recibiendo este correo de ${nombreTenant}.`;
}

/**
 * Escapa los caracteres HTML sensibles de un texto plano controlado por la app
 * (no de los tokens de Variables_Dinamicas, que se sustituyen después).
 *
 * Se aplica únicamente a valores estáticos derivados de la configuración del
 * tenant (su nombre), para evitar romper el marcado si contuvieran `<`, `>` o `&`.
 */
function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Envuelve el cuerpo de un correo en el layout HTML común del tenant.
 *
 * Produce un documento HTML completo (`<!DOCTYPE html>`, `<html lang=...>`,
 * `<meta charset>`, viewport) con un contenedor centrado de ancho máximo 600px,
 * cabecera con el nombre del tenant y pie de página formal (Requisito 3.3).
 *
 * @param opts Idioma, contenido del cuerpo y preheader opcional.
 * @returns El HTML completo del correo, listo para sustituir sus tokens.
 */
export function renderLayout(opts: OpcionesLayout): string {
  const { idioma, contenidoHtml, preheader } = opts;
  const nombreTenant = escaparHtml(tenantConfig.nombre);
  const lang = idioma === 'en' ? 'en' : 'es';

  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escaparHtml(
        preheader,
      )}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>${nombreTenant}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2933;">
${preheaderHtml}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:24px 0;">
<tr>
<td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e4e7eb;">
<tr>
<td style="background-color:#1f2933;padding:24px 32px;">
<span style="font-size:20px;font-weight:bold;color:#ffffff;letter-spacing:0.3px;">${nombreTenant}</span>
</td>
</tr>
<tr>
<td style="padding:32px;font-size:15px;line-height:1.6;color:#1f2933;">
${contenidoHtml}
</td>
</tr>
<tr>
<td style="background-color:#f4f5f7;padding:20px 32px;border-top:1px solid #e4e7eb;">
<p style="margin:0 0 6px 0;font-size:12px;line-height:1.5;color:#7b8794;">${textoPie(
    lang,
    nombreTenant,
  )}</p>
<p style="margin:0;font-size:12px;line-height:1.5;color:#9aa5b1;">${NOTA_PIE[lang]}</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}
