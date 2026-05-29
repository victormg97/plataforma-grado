/**
 * Orquestador de envío de correo transaccional (`Servicio_Correo`).
 *
 * Función pública única `sendNotificationEmail`, invocada de forma NO bloqueante
 * desde los puntos de disparo (`void sendNotificationEmail(...).catch(() => {})`).
 *
 * Principio rector: **el envío de correo NUNCA degrada la operación de negocio**.
 * Por ello esta función NUNCA lanza: toda la lógica vive dentro de un `try/catch`
 * y cualquier excepción inesperada se traduce en un intento de `Registro_Envio`
 * con resultado `fallo`; si incluso ese registro falla, se hace `console.error`
 * solo-servidor y se devuelve `fallo` (Requisito 4.6, 5.4, 15.6).
 *
 * Secuencia interna (ver diseño, sección "emailService.ts — Orquestador"):
 *   1. Deduplicación del evento (Requisito 16.8).
 *   2. Disponibilidad de la clave (Requisito 1.5, 1.8).
 *   3. Verificación del destinatario (Requisito 2, 2.6).
 *   4. Límite de tasa por originador y destinatario (Requisito 16.1–16.4).
 *   5. Construcción de la plantilla y sustitución de variables (Requisito 3, 5.2,
 *      5.3, 7.3, 15.3, 15.4, 3.2, 3.7).
 *   6. Envío vía Resend con timeout de 10 s (Requisito 4.5).
 *   7. Registro del resultado (Requisito 10.1, 10.2, 10.3).
 *
 * IMPORTANTE: archivo SOLO-SERVIDOR. Usa `createAdminClient()` (bypass RLS,
 * `SUPABASE_SERVICE_ROLE_KEY`) y `RESEND_API_KEY`; nunca debe importarse en
 * componentes de cliente.
 */

import { tenantConfig } from '@/config';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEmailEnabled, getResendClient } from './resendClient';
import { verificarDestinatario } from './recipientVerifier';
import {
  checkEmailRateLimitOriginador,
  checkEmailRateLimitDestinatario,
} from './emailRateLimit';
import { getDefaultTemplate } from './templates';
import { sustituirVariables } from './variables';
import type {
  SolicitudCorreo,
  ResultadoEnvio,
  ContenidoPlantilla,
} from './types';

/** Tiempo máximo de espera del envío vía Resend antes de considerarlo fallo (Requisito 4.5). */
const TIMEOUT_ENVIO_MS = 10_000;

/**
 * Promesa que se rechaza con `Error('timeout')` tras `ms` milisegundos.
 *
 * Se combina con `client.emails.send(...)` mediante `Promise.race` para acotar el
 * envío a `TIMEOUT_ENVIO_MS` (Requisito 4.5). `Promise.race` adjunta un manejador
 * interno a esta promesa, por lo que su rechazo posterior no queda sin manejar.
 */
function timeout(ms: number): Promise<never> {
  return new Promise<never>((_resolve, reject) => {
    setTimeout(() => reject(new Error('timeout')), ms);
  });
}

/**
 * Inserta un `Registro_Envio` en `email_envios` usando `createAdminClient()`
 * (bypass RLS, Requisito 10.1, 10.2, 10.3).
 *
 * Captura todos los errores internamente: NUNCA lanza. Un conflicto con la
 * restricción única parcial `(evento_id, destinatario_id) WHERE resultado =
 * 'enviado'` (código `23505`) significa que ya existe un envío exitoso para ese
 * evento/destinatario; se trata como benigno (no es un error fatal, Requisito
 * 16.8). Cualquier otro fallo de inserción se reporta con `console.error`
 * solo-servidor y la ejecución continúa.
 *
 * @param solicitud Datos del evento de correo (originador, destinatario, tipo…).
 * @param resultado Resultado del intento de envío a persistir.
 * @param motivo Detalle de la omisión o fallo; `null` para envíos exitosos.
 */
async function registrarEnvio(
  solicitud: SolicitudCorreo,
  resultado: ResultadoEnvio,
  motivo: string | null,
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('email_envios').insert({
      originador_id: solicitud.originadorId,
      destinatario_id: solicitud.destinatarioId,
      tipo: solicitud.tipo,
      resultado,
      motivo,
      horario_id: solicitud.horarioId ?? null,
      evento_id: solicitud.eventoId,
    });

    if (error) {
      // Conflicto con la restricción única parcial: ya existe un envío exitoso
      // para este evento+destinatario (Requisito 16.8). No es fatal.
      if (error.code === '23505') {
        return;
      }
      console.error(
        `[emailService] No se pudo registrar el envío (${resultado}): ${error.message}`,
      );
    }
  } catch (e) {
    // Si incluso el registro falla, log solo-servidor y continuar sin lanzar.
    console.error('[emailService] Excepción al registrar el Registro_Envio:', e);
  }
}

/**
 * Orquesta el envío completo de un correo de notificación.
 *
 * NUNCA lanza: devuelve siempre un `ResultadoEnvio` que refleja el desenlace del
 * intento. La operación de negocio que la invoca permanece intacta con
 * independencia del resultado (Requisito 1.6, 1.7, 4.6, 4.7, 5.4, 5.5, 15.6, 15.7).
 *
 * @param solicitud Petición de envío construida por el punto de disparo.
 * @returns El resultado del intento de envío.
 */
export async function sendNotificationEmail(
  solicitud: SolicitudCorreo,
): Promise<ResultadoEnvio> {
  try {
    const supabase = createAdminClient();

    // ── 1. Deduplicación del evento (Requisito 16.8) ─────────────────────────
    // Si ya existe un envío 'enviado' para este (evento_id, destinatario_id), no
    // se reenvía. Un error en la consulta no es fatal: se continúa y la
    // restricción única parcial protege contra duplicados en la inserción final.
    try {
      const { data: yaEnviado } = await supabase
        .from('email_envios')
        .select('id')
        .eq('evento_id', solicitud.eventoId)
        .eq('destinatario_id', solicitud.destinatarioId)
        .eq('resultado', 'enviado')
        .maybeSingle();

      if (yaEnviado) {
        return 'enviado';
      }
    } catch (e) {
      console.error('[emailService] Error en la consulta de deduplicación:', e);
    }

    // ── 2. Disponibilidad de la clave (Requisito 1.5, 1.8) ───────────────────
    if (!isEmailEnabled()) {
      console.warn(
        '[emailService] Envío de correo deshabilitado: RESEND_API_KEY no configurada.',
      );
      await registrarEnvio(solicitud, 'omitido_sin_clave', 'resend_api_key_no_configurada');
      return 'omitido_sin_clave';
    }

    // ── 3. Verificación del destinatario (Requisito 2, 2.6) ──────────────────
    const verificacion = verificarDestinatario(solicitud.destinatarioEmail);
    if (!verificacion.entregable) {
      await registrarEnvio(solicitud, 'omitido_destinatario', verificacion.motivo);
      return 'omitido_destinatario';
    }

    // ── 4. Límite de tasa: originador y destinatario (Requisito 16.1–16.4) ───
    const [limiteOriginador, limiteDestinatario] = await Promise.all([
      checkEmailRateLimitOriginador(solicitud.originadorId),
      checkEmailRateLimitDestinatario(solicitud.destinatarioEmail),
    ]);

    if (!limiteOriginador.allowed || !limiteDestinatario.allowed) {
      const motivo = !limiteOriginador.allowed
        ? `rate_limit_originador (retryAfter=${limiteOriginador.retryAfterSeconds}s)`
        : `rate_limit_destinatario (retryAfter=${limiteDestinatario.retryAfterSeconds}s)`;
      await registrarEnvio(solicitud, 'omitido_rate_limit', motivo);
      return 'omitido_rate_limit';
    }

    // ── 5. Construcción de la plantilla (Requisito 3.2, 3.7, 5.2, 5.3, 7.3, 15.3, 15.4) ──
    // El propietario de la plantilla es `plantillaOwnerId` cuando se provee
    // (caso `solicitud_cambio_horario`: el profesor propietario del horario), o
    // el originador en el resto de los casos.
    const ownerId = solicitud.plantillaOwnerId ?? solicitud.originadorId;

    let contenido: ContenidoPlantilla;
    try {
      const { data: plantillaPersonalizada } = await supabase
        .from('email_plantillas')
        .select('asunto, cuerpo_html')
        .eq('user_id', ownerId)
        .eq('tipo', solicitud.tipo)
        .maybeSingle();

      contenido = plantillaPersonalizada
        ? {
            asunto: plantillaPersonalizada.asunto as string,
            cuerpoHtml: plantillaPersonalizada.cuerpo_html as string,
          }
        : getDefaultTemplate(solicitud.tipo, solicitud.destinatarioIdioma);
    } catch (e) {
      // Si la carga de la plantilla personalizada falla, degradar a la default
      // (Requisito 3.2) sin abortar el envío.
      console.error('[emailService] Error al cargar la plantilla personalizada:', e);
      contenido = getDefaultTemplate(solicitud.tipo, solicitud.destinatarioIdioma);
    }

    const asuntoSustituido = sustituirVariables(contenido.asunto, solicitud.variables);
    const cuerpoSustituido = sustituirVariables(contenido.cuerpoHtml, solicitud.variables);

    // Remitente derivado del tenant activo (Requisito 3.7, 12.1): sin ids de
    // tenant codificados, todo proviene de `tenantConfig`. Se usa `emailFrom`
    // (dominio verificado en Resend, p. ej. un subdominio) cuando está definido;
    // en su defecto se deriva `no-reply@${emailDomain}`.
    const direccionRemitente = tenantConfig.emailFrom ?? `no-reply@${tenantConfig.emailDomain}`;
    const from = `${tenantConfig.nombre} <${direccionRemitente}>`;

    // ── 6. Envío vía Resend con timeout de 10 s (Requisito 4.5) ──────────────
    const client = getResendClient();
    if (!client) {
      // No debería ocurrir tras `isEmailEnabled()`, pero por robustez se trata
      // como omisión por ausencia de clave (Requisito 1.5).
      console.warn(
        '[emailService] getResendClient() devolvió null pese a isEmailEnabled().',
      );
      await registrarEnvio(solicitud, 'omitido_sin_clave', 'cliente_resend_no_disponible');
      return 'omitido_sin_clave';
    }

    try {
      const respuesta = await Promise.race([
        client.emails.send({
          from,
          to: solicitud.destinatarioEmail,
          subject: asuntoSustituido,
          html: cuerpoSustituido,
        }),
        timeout(TIMEOUT_ENVIO_MS),
      ]);

      // La API de Resend responde `{ data, error }`: un `error` no nulo indica
      // un fallo del proveedor (Requisito 4.5).
      if (respuesta.error) {
        await registrarEnvio(solicitud, 'fallo', `resend_error: ${respuesta.error.message}`);
        return 'fallo';
      }

      // ── 7. Registro de éxito (Requisito 10.1, 10.2) ────────────────────────
      await registrarEnvio(solicitud, 'enviado', null);
      return 'enviado';
    } catch (e) {
      // Timeout (Requisito 4.5) o excepción de la llamada a Resend.
      const detalle = e instanceof Error ? e.message : String(e);
      await registrarEnvio(solicitud, 'fallo', `excepcion_envio: ${detalle}`);
      return 'fallo';
    }
  } catch (error) {
    // Red de seguridad final: cualquier excepción inesperada se traduce a un
    // intento de Registro_Envio 'fallo'. Si incluso eso falla, log solo-servidor.
    // La función NUNCA lanza (Requisito 4.6, 5.4, 15.6).
    try {
      const detalle = error instanceof Error ? error.message : String(error);
      await registrarEnvio(solicitud, 'fallo', `excepcion_inesperada: ${detalle}`);
    } catch (e) {
      console.error(
        '[emailService] Error crítico irrecuperable en sendNotificationEmail:',
        e,
      );
    }
    return 'fallo';
  }
}
