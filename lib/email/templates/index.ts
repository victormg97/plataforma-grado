/**
 * Punto de entrada (barrel) de las Plantillas_Default del módulo de correo.
 *
 * Reúne las cuatro plantillas por defecto (una por `TipoCorreo`, cada una con sus
 * variantes `es`/`en`) y expone dos utilidades de selección:
 *
 * - `normalizarIdioma`: normaliza el `idioma` del perfil del destinatario al
 *   conjunto soportado, con español por defecto (Requisito 3.5, 3.6).
 * - `getDefaultTemplate`: devuelve la Plantilla_Default para un tipo e idioma
 *   (Requisito 3.1, 3.2).
 *
 * Las cuatro plantillas exportan el mismo nombre (`plantilla`), por lo que aquí se
 * importan con alias para combinarlas en un único mapa por tipo.
 */

import type { TipoCorreo, IdiomaCorreo, ContenidoPlantilla } from '../types';
import { plantilla as confirmacion } from './confirmacion';
import { plantilla as cancelacion } from './cancelacion';
import { plantilla as solicitudCambioHorario } from './solicitudCambioHorario';
import { plantilla as programaAsignado } from './programaAsignado';
import { plantilla as nuevaClase } from './nuevaClase';
import { plantilla as invitacionAcceso } from './invitacionAcceso';

/**
 * Normaliza el idioma del perfil del destinatario a un `IdiomaCorreo` soportado.
 *
 * Devuelve `'es'` o `'en'` únicamente cuando el valor recibido es exactamente uno
 * de esos códigos; para cualquier otro valor —incluido `null`, `undefined`, una
 * cadena vacía o un idioma no soportado— devuelve `'es'` (español por defecto).
 *
 * _Requisito 3.5_: idioma soportado (`es`/`en`) → ese idioma.
 * _Requisito 3.6_: idioma ausente o no soportado → español.
 */
export function normalizarIdioma(idioma: string | null | undefined): IdiomaCorreo {
  return idioma === 'es' || idioma === 'en' ? idioma : 'es';
}

/**
 * Mapa de Plantillas_Default por tipo de correo y por idioma.
 *
 * Cada entrada combina las variantes `es`/`en` de la plantilla correspondiente.
 * Las claves del enum (`solicitud_cambio_horario`, `programa_asignado`) se mapean
 * a sus módulos en camelCase.
 *
 * _Requisito 3.1_: existe una Plantilla_Default para cada `TipoCorreo`.
 */
const PLANTILLAS: Record<TipoCorreo, Record<IdiomaCorreo, ContenidoPlantilla>> = {
  confirmacion,
  cancelacion,
  solicitud_cambio_horario: solicitudCambioHorario,
  programa_asignado: programaAsignado,
  nueva_clase: nuevaClase,
  invitacion_acceso: invitacionAcceso,
};

/**
 * Devuelve la Plantilla_Default para un tipo de correo en el idioma del
 * destinatario.
 *
 * El idioma se normaliza con `normalizarIdioma`, de modo que un valor ausente o
 * no soportado resuelve a la variante en español (Requisito 3.5, 3.6).
 *
 * _Requisito 3.1_: cada `TipoCorreo` tiene una Plantilla_Default definida.
 * _Requisito 3.2_: se usa la Plantilla_Default cuando no hay personalización.
 */
export function getDefaultTemplate(
  tipo: TipoCorreo,
  idioma: string | null | undefined,
): ContenidoPlantilla {
  return PLANTILLAS[tipo][normalizarIdioma(idioma)];
}
