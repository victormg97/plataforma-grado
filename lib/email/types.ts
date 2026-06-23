/**
 * Tipos compartidos del módulo de correo (`lib/email/`).
 *
 * Este archivo es solo-servidor en la práctica (lo consumen el orquestador, las
 * plantillas, el verificador y los puntos de disparo), pero no importa nada del
 * lado del servidor, por lo que también puede usarse para tipar contratos de API.
 *
 * Centraliza los contratos de datos del envío de correo transaccional mediante
 * Resend, manteniéndolos coherentes con el enum `tipo_notificacion` de la base de
 * datos y con el diseño de la funcionalidad.
 */

import type { TipoNotificacion } from '@/lib/supabase/types';

/**
 * Tipos de correo soportados por la funcionalidad.
 *
 * Es un subconjunto estricto de `TipoNotificacion` (enum `tipo_notificacion`):
 * usar `Extract` garantiza en tiempo de compilación que cada valor existe en el
 * enum, de modo que un cambio incompatible en el enum rompa la compilación aquí.
 *
 * _Requisito 3.1_: define los tipos para los que existe una Plantilla_Default
 * (`confirmacion`, `cancelacion`, `solicitud_cambio_horario`,
 * `programa_asignado`).
 * _Requisitos 18.9, 19.4_: añade `nueva_clase` (aviso de clase recién creada) e
 * `invitacion_acceso` (invitación de acceso a un usuario recién creado).
 */
export type TipoCorreo = Extract<
  TipoNotificacion,
  'confirmacion' | 'cancelacion' | 'solicitud_cambio_horario' | 'programa_asignado' | 'nueva_clase' | 'invitacion_acceso' | 'bienvenida_registro' | 'nueva_nota_clase'
>;

/**
 * Resultado del intento de envío, persistido en la columna `resultado` de la
 * tabla `email_envios`.
 *
 * - `enviado`: Resend aceptó el correo.
 * - `fallo`: error del proveedor o timeout (Requisito 4.5, 5.4, 15.6).
 * - `omitido_sin_clave`: `RESEND_API_KEY` ausente/vacía (Requisito 1.5).
 * - `omitido_destinatario`: destinatario no entregable (Requisito 2).
 * - `omitido_rate_limit`: límite de tasa excedido (Requisito 16.4).
 *
 * _Requisito 10.2_.
 */
export type ResultadoEnvio =
  | 'enviado'
  | 'fallo'
  | 'omitido_sin_clave'
  | 'omitido_destinatario'
  | 'omitido_rate_limit';

/**
 * Idiomas soportados por las Plantillas_Default.
 *
 * El idioma del perfil del destinatario se normaliza a este conjunto, con `'es'`
 * como valor por defecto cuando es ausente o no soportado (Requisito 3.5, 3.6).
 */
export type IdiomaCorreo = 'es' | 'en';

/**
 * Valores reales de las Variables_Dinamicas para un evento concreto.
 *
 * Todos los campos son opcionales: una variable sin valor disponible se sustituye
 * por una cadena vacía al construir el correo (Requisito 8.5, 9.4).
 *
 * _Requisito 8.4_: incluye las variables comunes (nombre del destinatario, nombre
 * del alumno, título de la clase, fecha, `hora_inicio`, `hora_fin`, `enlace_clase`).
 * _Requisito 15.5_: incluye además las variables específicas del tipo
 * `solicitud_cambio_horario` (fecha y horas propuestas, nota del alumno).
 */
export interface VariablesCorreo {
  /** Nombre del usuario que recibe el correo (`{nombre_destinatario}`). */
  nombre_destinatario?: string;
  /** Nombre del alumno asociado al evento (`{nombre_alumno}`). */
  nombre_alumno?: string;
  /** Título de la clase referenciada (`{titulo_clase}`). */
  titulo_clase?: string;
  /** Descripción de la clase referenciada (`{descripcion_clase}`). */
  descripcion_clase?: string;
  /** Fecha de la clase (`{fecha}`). */
  fecha?: string;
  /** Hora de inicio de la clase (`{hora_inicio}`). */
  hora_inicio?: string;
  /** Hora de fin de la clase (`{hora_fin}`). */
  hora_fin?: string;
  /** Enlace_Clase absoluto basado en `NEXT_PUBLIC_APP_URL` (`{enlace_clase}`). */
  enlace_clase?: string;

  // Variables específicas de `solicitud_cambio_horario` (Requisito 15.5):
  /** Fecha propuesta por el alumno (`{fecha_propuesta}`). */
  fecha_propuesta?: string;
  /** Hora de inicio propuesta por el alumno (`{hora_inicio_propuesta}`). */
  hora_inicio_propuesta?: string;
  /** Hora de fin propuesta por el alumno (`{hora_fin_propuesta}`). */
  hora_fin_propuesta?: string;
  /** Nota o comentario del alumno en la solicitud (`{nota_alumno}`). */
  nota_alumno?: string;

  // Variables específicas de `invitacion_acceso` (Requisito 19.4):
  /** Enlace_Acceso absoluto `${NEXT_PUBLIC_APP_URL}/setup/${code}` (`{enlace_acceso}`) — Requisito 19.4 */
  enlace_acceso?: string;
  /** Correo con el que el usuario recién creado accederá (`{email_acceso}`) — Requisito 19.4 */
  email_acceso?: string;

  // Variables específicas de `bienvenida_registro`:
  /** Descripción corta del acceso del usuario según su rol (`{descripcion_acceso}`). */
  descripcion_acceso?: string;

  // Variables específicas de `nueva_nota_clase`:
  /** Contenido HTML de la nota de clase (`{contenido_nota}`). */
  contenido_nota?: string;
  /** Nombre completo del autor de la nota (`{nombre_autor}`). */
  nombre_autor?: string;
}

/**
 * Contenido de una plantilla de correo, ya sea la Plantilla_Default o una
 * Plantilla_Correo personalizada por un Usuario_Editor.
 *
 * El asunto debe ser no vacío de 1 a 200 caracteres y el cuerpo HTML no vacío
 * (Requisito 3.4, 7.6).
 */
export interface ContenidoPlantilla {
  /** Asunto del correo (1–200 caracteres, no vacío). */
  asunto: string;
  /** Cuerpo del correo en formato HTML (no vacío). */
  cuerpoHtml: string;
}

/**
 * Petición de envío que recibe el Servicio_Correo (`sendNotificationEmail`).
 *
 * Reúne todo lo necesario para deduplicar, verificar, limitar, construir, enviar
 * y registrar un correo, sin que el punto de disparo conozca los detalles internos.
 *
 * _Requisito 10.2_: `originadorId`, `destinatarioId`, `tipo` y `horarioId` se
 * persisten en el Registro_Envio.
 * _Requisito 16.8_: `eventoId` identifica el evento de negocio para impedir
 * envíos duplicados al mismo destinatario.
 */
export interface SolicitudCorreo {
  /** Tipo de correo a construir y la Plantilla_Default asociada. */
  tipo: TipoCorreo;
  /** `profiles.id` del usuario que origina la notificación (Requisito 10.2). */
  originadorId: string;
  /** `profiles.id` del destinatario del correo. */
  destinatarioId: string;
  /** `profiles.email` del destinatario, a verificar antes de enviar (Requisito 2). */
  destinatarioEmail: string;
  /** `profiles.idioma` del destinatario; se normaliza a `IdiomaCorreo` (Requisito 3.6). */
  destinatarioIdioma: string | null;
  /** Valores reales de las Variables_Dinamicas para este evento. */
  variables: VariablesCorreo;
  /** `horarios.id` de la clase asociada, si existe (Requisito 10.2, 9.4). */
  horarioId?: string | null;
  /** Identificador único del evento de negocio para prevenir duplicados (Requisito 16.8). */
  eventoId: string;
  /**
   * Propietario de la Plantilla_Correo a usar para la SELECCIÓN de plantilla.
   *
   * Cuando se provee, anula `originadorId` para cargar la plantilla personalizada.
   * Caso `solicitud_cambio_horario`: el originador es el alumno, pero la plantilla
   * la posee el profesor propietario del horario (destinatario), por lo que se
   * pasa `plantillaOwnerId = profesorId` (Requisito 15.3).
   */
  plantillaOwnerId?: string;
}
