/**
 * Envoltorio HTML común de los correos transaccionales (`lib/email/templates/`).
 *
 * Todas las Plantillas_Default envuelven el cuerpo específico de su tipo con este
 * layout para producir un correo formal, completo y consistente: estructura HTML
 * válida con estilos en línea (compatibles con clientes de correo, sin clases CSS
 * externas ni Tailwind), cabecera con el logo/nombre del tenant y un pie de página
 * formal con una nota de correo automático.
 *
 * Usa los colores de marca del tenant activo (`tenantConfig.theme`) y, cuando es
 * posible, muestra el logo (versión light) en la cabecera. Esto mantiene los
 * correos alineados con la identidad visual de cada tenant sin codificar valores.
 *
 * Este módulo solo ENVUELVE el contenido: los tokens de Variables_Dinamicas (p.ej.
 * `{nombre_destinatario}`, `{titulo_clase}`, `{enlace_clase}`) los aporta cada
 * plantilla en su `contenidoHtml` y los sustituye después `sustituirVariables`.
 */

import { tenantConfig } from '@/config';
import type { IdiomaCorreo } from '../types';

// ─── Colores de marca del tenant activo ──────────────────────────────────────
// `colorAccent` es obligatorio en el theme; `colorAccentForeground` es opcional y
// por defecto se usa blanco (texto legible sobre el color de marca).
const COLOR_ACENTO = tenantConfig.theme.colorAccent;
const COLOR_ACENTO_TEXTO = tenantConfig.theme.colorAccentForeground ?? '#ffffff';

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

/** Nota de pie por idioma indicando que el correo es automático. */
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
 */
function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Base absoluta de la app (sin barra final), para construir URLs de imágenes. */
function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
}

/**
 * URL absoluta del logo (versión light) del tenant para incrustar en el correo.
 *
 * Se referencia por URL (no se incrusta en base64), de modo que el HTML del correo
 * permanece liviano y el cliente de correo descarga la imagen bajo demanda.
 * Devuelve `null` si no hay `NEXT_PUBLIC_APP_URL` configurada (en ese caso el
 * layout cae a mostrar el nombre del tenant como texto).
 */
function logoUrl(): string | null {
  const base = appUrl();
  if (!base) return null;
  return `${base}${tenantConfig.logoLight}`;
}

/**
 * Botón de acción reutilizable con los colores de marca del tenant.
 *
 * Pensado para usarse dentro del `contenidoHtml` de cada plantilla. El `href`
 * puede contener un token (p.ej. `{enlace_clase}`) que se sustituye después.
 *
 * @param opts.href URL o token de destino del botón.
 * @param opts.texto Texto visible del botón.
 * @returns HTML del botón con el color de marca como fondo.
 */
export function renderBoton(opts: { href: string; texto: string }): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px 0;"><tr><td style="border-radius:6px;background-color:${COLOR_ACENTO};">
<a href="${opts.href}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:bold;color:${COLOR_ACENTO_TEXTO};text-decoration:none;">${opts.texto}</a>
</td></tr></table>`;
}

/**
 * Envuelve el cuerpo de un correo en el layout HTML común del tenant.
 *
 * Produce un documento HTML completo con un contenedor centrado de ancho máximo
 * 600px, una barra superior con el color de marca, cabecera con el logo (o el
 * nombre del tenant como respaldo) y pie de página formal.
 *
 * @param opts Idioma, contenido del cuerpo y preheader opcional.
 * @returns El HTML completo del correo, listo para sustituir sus tokens.
 */
export function renderLayout(opts: OpcionesLayout): string {
  const { idioma, contenidoHtml, preheader } = opts;
  const nombreTenant = escaparHtml(tenantConfig.nombre);
  const lang = idioma === 'en' ? 'en' : 'es';
  const logo = logoUrl();

  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escaparHtml(
        preheader,
      )}</div>`
    : '';

  const cabeceraInterior = logo
    ? `<img src="${logo}" alt="${nombreTenant}" height="44" style="display:block;height:44px;max-height:44px;width:auto;border:0;outline:none;text-decoration:none;" />`
    : `<span style="font-size:20px;font-weight:bold;color:${COLOR_ACENTO};">${nombreTenant}</span>`;

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
<td style="background-color:${COLOR_ACENTO};height:4px;line-height:4px;font-size:0;">&nbsp;</td>
</tr>
<tr>
<td style="background-color:#ffffff;padding:24px 32px;border-bottom:1px solid #e4e7eb;" align="left">
${cabeceraInterior}
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
