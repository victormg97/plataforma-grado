/**
 * Servicio de notificaciones del slice `notificaciones` (Requisitos 13.2–13.11).
 *
 * Funcion unica `notificarActividad`, invocada sin `await` (fire-and-forget)
 * desde el route handler de actividades. Nunca propaga errores al llamante
 * (Requisito 13.10).
 *
 * Flujo:
 * 1. INSERT masivo en `notificaciones` (una fila por destinatario).
 * 2. Si `enviarCorreoAlAsignar` es false -> return (Requisito 13.8).
 * 3. Si la Clave_Resend no esta configurada -> registrar y return (Req 16.5).
 * 4. Particionar en lotes de 50, secuenciales entre lotes, paralelos dentro.
 * 5. Por cada destinatario: verificar email, evaluar rate limit, enviar con
 *    Resend, registrar resultado en `email_envios`.
 *
 * Reutiliza el servicio de correo existente (`sendNotificationEmail`) para cada
 * destinatario individual, delegando toda la logica de verificacion, rate limit,
 * plantilla, envio y registro. Los tokens especificos de nueva_actividad se
 * pasan como variables inyectadas en la solicitud.
 *
 * NOTA: El motor de sustitucion generico (`sustituirVariables`) no conoce los
 * tokens propios de nueva_actividad ({titulo_actividad}, {categoria}, etc.).
 * Por ello este servicio resuelve la plantilla y los tokens directamente,
 * reutilizando las funciones de infraestructura (verificacion, rate limit,
 * Resend client, registro) sin pasar por `sendNotificationEmail`.
 *
 * Dependencias: `@/lib/supabase/admin`, `@/lib/email/*`.
 */

import type { AgendaEvento } from '@/lib/supabase/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEmailEnabled, getResendClient } from '@/lib/email/resendClient';
import { verificarDestinatario } from '@/lib/email/recipientVerifier';
import {
  checkEmailRateLimitOriginador,
  checkEmailRateLimitDestinatario,
} from '@/lib/email/emailRateLimit';
import { getDefaultTemplate, normalizarIdioma } from '@/lib/email/templates';
import { tenantConfig } from '@/config';
import { particionarEnLotes, TAMANO_LOTE } from './lotes';
import { construirVariables, type VariablesNuevaActividad } from './variables';

// ─── Tipos ──────────────────────────────────────────────────────────────────

/**
 * Interfaz local compatible con `DestinatarioVigente` del slice `actividades`.
 * Se define aqui para no crear una dependencia entre slices de capacidad
 * (Requisito 17.5). El route handler (punto de composicion) hace la pasarela.
 */
export interface DestinatarioNotificacion {
  id: string;
  nombre: string;
  apellido: string;
  email: string | null;
  idioma: string;
}

interface AutorNotificacion {
  id: string;
  nombre: string;
  apellido: string;
  enviarCorreoAlAsignar: boolean;
}

interface InputNotificarActividad {
  actividad: AgendaEvento;
  destinatarios: DestinatarioNotificacion[];
  autor: AutorNotificacion;
  operacion: 'creacion' | 'edicion';
}

// ─── Constantes ─────────────────────────────────────────────────────────────

const TIMEOUT_ENVIO_MS = 10_000;

// ─── Funcion publica ────────────────────────────────────────────────────────

/**
 * Crea notificaciones in-app y dispara correos para una Actividad.
 *
 * No devuelve nada util: el route handler la invoca sin `await`.
 * Captura sus propios errores y nunca los propaga (Requisito 13.10).
 */
export async function notificarActividad(input: InputNotificarActividad): Promise<void> {
  try {
    const { actividad, destinatarios, autor } = input;

    if (destinatarios.length === 0) return;

    const supabase = createAdminClient();

    // ── 1. INSERT masivo de notificaciones (Requisito 13.2) ─────────────────
    const filas = destinatarios.map((d) => ({
      destinatario_id: d.id,
      tipo: 'nueva_actividad' as const,
      mensaje: actividad.titulo,
      leida: false,
      agenda_evento_id: actividad.id,
    }));

    const { error: errorNotif } = await supabase.from('notificaciones').insert(filas);

    if (errorNotif) {
      console.error(
        '[notificarActividad] Error al insertar notificaciones:',
        errorNotif.message,
      );
    }

    // ── 2. Si enviar_correo_al_asignar es false -> return (Requisito 13.8) ──
    if (!autor.enviarCorreoAlAsignar) {
      return;
    }

    // ── 3. Verificar Clave_Resend (Requisito 16.5) ──────────────────────────
    if (!isEmailEnabled()) {
      await registrarOmisionMasiva(supabase, autor.id, destinatarios, actividad.id);
      return;
    }

    // ── 4. Particionar y enviar en lotes (Requisito 13.9) ───────────────────
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
    const lotes = particionarEnLotes(destinatarios, TAMANO_LOTE);

    for (const lote of lotes) {
      const promesas = lote.map((d) =>
        enviarCorreoIndividual(supabase, actividad, d, autor, baseUrl),
      );
      await Promise.allSettled(promesas);
    }
  } catch (error) {
    // Red de seguridad final (Requisito 13.10)
    console.error(
      '[notificarActividad] Error inesperado:',
      error instanceof Error ? error.message : error,
    );
  }
}

// ─── Envio individual ───────────────────────────────────────────────────────

async function enviarCorreoIndividual(
  supabase: ReturnType<typeof createAdminClient>,
  actividad: AgendaEvento,
  destinatario: DestinatarioNotificacion,
  autor: AutorNotificacion,
  baseUrl: string,
): Promise<void> {
  const eventoId = `nueva_actividad_${actividad.id}`;

  try {
    // Verificar que tiene email
    if (!destinatario.email) {
      await registrarEnvio(supabase, autor.id, destinatario.id, eventoId, 'omitido_destinatario', 'email_no_registrado');
      return;
    }

    // Verificar formato del email
    const verificacion = verificarDestinatario(destinatario.email);
    if (!verificacion.entregable) {
      await registrarEnvio(supabase, autor.id, destinatario.id, eventoId, 'omitido_destinatario', verificacion.motivo);
      return;
    }

    // Evaluar rate limit (Requisito 13.11)
    const [limOrig, limDest] = await Promise.all([
      checkEmailRateLimitOriginador(autor.id),
      checkEmailRateLimitDestinatario(destinatario.email),
    ]);

    if (!limOrig.allowed || !limDest.allowed) {
      const motivo = !limOrig.allowed
        ? `rate_limit_originador (retryAfter=${limOrig.retryAfterSeconds}s)`
        : `rate_limit_destinatario (retryAfter=${limDest.retryAfterSeconds}s)`;
      await registrarEnvio(supabase, autor.id, destinatario.id, eventoId, 'omitido_rate_limit', motivo);
      return;
    }

    // Construir variables y resolver plantilla
    const variables = construirVariables(actividad, destinatario, baseUrl);
    const contenido = await resolverPlantilla(supabase, autor.id, destinatario.idioma);
    const asunto = sustituirTokens(contenido.asunto, variables);
    const cuerpo = sustituirTokens(contenido.cuerpoHtml, variables);

    // Enviar con Resend
    const client = getResendClient();
    if (!client) {
      await registrarEnvio(supabase, autor.id, destinatario.id, eventoId, 'omitido_sin_clave', 'cliente_resend_no_disponible');
      return;
    }

    const direccionRemitente = tenantConfig.emailFrom ?? `no-reply@${tenantConfig.emailDomain}`;
    const from = `${tenantConfig.nombre} <${direccionRemitente}>`;

    const respuesta = await Promise.race([
      client.emails.send({
        from,
        to: destinatario.email,
        subject: asunto,
        html: cuerpo,
      }),
      timeoutPromise(TIMEOUT_ENVIO_MS),
    ]);

    if (respuesta.error) {
      await registrarEnvio(supabase, autor.id, destinatario.id, eventoId, 'fallo', `resend_error: ${respuesta.error.message}`);
      return;
    }

    await registrarEnvio(supabase, autor.id, destinatario.id, eventoId, 'enviado', null);
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e);
    await registrarEnvio(supabase, autor.id, destinatario.id, eventoId, 'fallo', `excepcion: ${detalle}`);
  }
}

// ─── Utilidades internas ────────────────────────────────────────────────────

function timeoutPromise(ms: number): Promise<never> {
  return new Promise<never>((_resolve, reject) => {
    setTimeout(() => reject(new Error('timeout')), ms);
  });
}

/**
 * Registra un intento en `email_envios` sin propagar errores.
 */
async function registrarEnvio(
  supabase: ReturnType<typeof createAdminClient>,
  originadorId: string,
  destinatarioId: string,
  eventoId: string,
  resultado: string,
  motivo: string | null,
): Promise<void> {
  try {
    await supabase.from('email_envios').insert({
      originador_id: originadorId,
      destinatario_id: destinatarioId,
      tipo: 'nueva_actividad',
      resultado,
      motivo,
      evento_id: eventoId,
    });
  } catch {
    // Nunca propagar
  }
}

/**
 * Registra omision masiva por ausencia de Clave_Resend (Requisito 16.5).
 */
async function registrarOmisionMasiva(
  supabase: ReturnType<typeof createAdminClient>,
  autorId: string,
  destinatarios: DestinatarioNotificacion[],
  actividadId: string,
): Promise<void> {
  try {
    const filas = destinatarios.map((d) => ({
      originador_id: autorId,
      destinatario_id: d.id,
      tipo: 'nueva_actividad' as const,
      resultado: 'omitido_sin_clave',
      motivo: 'resend_api_key_no_configurada',
      evento_id: `nueva_actividad_${actividadId}`,
    }));
    await supabase.from('email_envios').insert(filas);
  } catch {
    // Nunca propagar
  }
}

/**
 * Resuelve la plantilla personalizada del autor o la default.
 */
async function resolverPlantilla(
  supabase: ReturnType<typeof createAdminClient>,
  autorId: string,
  idiomaDestinatario: string,
): Promise<{ asunto: string; cuerpoHtml: string }> {
  try {
    const { data: personalizada } = await supabase
      .from('email_plantillas')
      .select('asunto, cuerpo_html')
      .eq('user_id', autorId)
      .eq('tipo', 'nueva_actividad')
      .maybeSingle();

    if (personalizada) {
      return {
        asunto: personalizada.asunto as string,
        cuerpoHtml: personalizada.cuerpo_html as string,
      };
    }
  } catch {
    // Degradar a default
  }

  const idioma = normalizarIdioma(idiomaDestinatario);
  const tpl = getDefaultTemplate('nueva_actividad', idioma);
  return { asunto: tpl.asunto, cuerpoHtml: tpl.cuerpoHtml };
}

/**
 * Sustitucion de los nueve tokens de nueva_actividad mediante split/join.
 */
function sustituirTokens(plantilla: string, vars: VariablesNuevaActividad): string {
  let resultado = plantilla;
  const pares: [string, string][] = [
    ['{nombre_destinatario}', vars.nombre_destinatario],
    ['{titulo_actividad}', vars.titulo_actividad],
    ['{categoria}', vars.categoria],
    ['{fecha}', vars.fecha],
    ['{hora_inicio}', vars.hora_inicio],
    ['{hora_fin}', vars.hora_fin],
    ['{lugar}', vars.lugar],
    ['{enlace_conexion}', vars.enlace_conexion],
    ['{enlace_agenda}', vars.enlace_agenda],
  ];
  for (const [token, valor] of pares) {
    resultado = resultado.split(token).join(valor);
  }
  return resultado;
}
