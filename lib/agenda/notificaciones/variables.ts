/**
 * Variables dinamicas para el correo `nueva_actividad` (Requisito 13.6).
 *
 * Construye las nueve variables que la plantilla `nuevaActividad.ts` espera,
 * resolviendo la categoria y el formato de fecha en el servidor en el idioma
 * del perfil del destinatario. Campos opcionales vacios se sustituyen por
 * cadena vacia.
 */

import type { AgendaEvento } from '@/lib/supabase/types';
import type { CategoriaAgenda } from '@/lib/supabase/types';

// ─── Tipo de salida ─────────────────────────────────────────────────────────

/**
 * Las nueve variables del Requisito 13.6, listas para sustituir en la plantilla.
 */
export interface VariablesNuevaActividad {
  nombre_destinatario: string;
  titulo_actividad: string;
  categoria: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  lugar: string;
  enlace_conexion: string;
  enlace_agenda: string;
}

// ─── Mapas de etiquetas de categoria por idioma ─────────────────────────────
// Se resuelven en el servidor sin depender de next-intl (que es de cliente/SSR
// con React). El conjunto cerrado de ocho valores reproduce las claves de
// `agendaNucleo.categorias` de messages/es.json y messages/en.json.

const CATEGORIAS_ES: Record<CategoriaAgenda, string> = {
  clase: 'Clase',
  reunion: 'Reunion',
  estudio: 'Estudio',
  personal: 'Personal',
  administrativo: 'Administrativo',
  evento_externo: 'Evento externo',
  plazo: 'Plazo',
  otro: 'Otro',
};

const CATEGORIAS_EN: Record<CategoriaAgenda, string> = {
  clase: 'Class',
  reunion: 'Meeting',
  estudio: 'Study',
  personal: 'Personal',
  administrativo: 'Administrative',
  evento_externo: 'External event',
  plazo: 'Deadline',
  otro: 'Other',
};

// ─── Etiquetas de dia completo por idioma ───────────────────────────────────

const DIA_COMPLETO_ES = 'Dia completo';
const DIA_COMPLETO_EN = 'All day';

// ─── Helpers internos ───────────────────────────────────────────────────────

type IdiomaCorreo = 'es' | 'en';

function normalizarIdioma(idioma: string | null | undefined): IdiomaCorreo {
  return idioma === 'en' ? 'en' : 'es';
}

/**
 * Resuelve la etiqueta de la categoria en el idioma del destinatario.
 */
function resolverCategoria(categoria: CategoriaAgenda, idioma: IdiomaCorreo): string {
  return idioma === 'en'
    ? (CATEGORIAS_EN[categoria] ?? categoria)
    : (CATEGORIAS_ES[categoria] ?? categoria);
}

/**
 * Formatea la fecha ISO (YYYY-MM-DD) al formato legible del idioma:
 * - es: DD-MM-YYYY (patron chileno)
 * - en: MM-DD-YYYY
 */
function formatearFecha(fechaIso: string, idioma: IdiomaCorreo): string {
  if (!fechaIso) return '';
  const match = fechaIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return fechaIso;
  const [, year, month, day] = match;
  return idioma === 'en' ? `${month}-${day}-${year}` : `${day}-${month}-${year}`;
}

/**
 * Formatea la hora (HH:mm:ss o HH:mm) a HH:mm.
 */
function formatearHora(hora: string | null | undefined): string {
  if (!hora) return '';
  // Trim seconds if present: '09:00:00' -> '09:00'
  return hora.slice(0, 5);
}

// ─── Funcion publica ────────────────────────────────────────────────────────

/**
 * Construye las nueve variables de la plantilla `nueva_actividad`.
 *
 * - `categoria` se resuelve al idioma del destinatario (Requisito 13.6).
 * - `fecha` se formatea segun el idioma del destinatario.
 * - Si la actividad es de dia completo, `hora_inicio` y `hora_fin` se reemplazan
 *   por la etiqueta de dia completo (Requisito 10.14).
 * - Los campos opcionales vacios se devuelven como cadena vacia.
 *
 * @param actividad Datos del evento (Pick de los campos necesarios).
 * @param destinatario Nombre e idioma del perfil del destinatario.
 * @param baseUrl URL base de la aplicacion (NEXT_PUBLIC_APP_URL).
 */
export function construirVariables(
  actividad: Pick<
    AgendaEvento,
    'titulo' | 'categoria' | 'fecha' | 'hora_inicio' | 'hora_fin' | 'dia_completo' | 'lugar' | 'enlace_conexion'
  >,
  destinatario: { nombre: string; idioma: string },
  baseUrl: string,
): VariablesNuevaActividad {
  const idioma = normalizarIdioma(destinatario.idioma);

  const etiquetaDiaCompleto = idioma === 'en' ? DIA_COMPLETO_EN : DIA_COMPLETO_ES;

  return {
    nombre_destinatario: destinatario.nombre || '',
    titulo_actividad: actividad.titulo || '',
    categoria: resolverCategoria(actividad.categoria, idioma),
    fecha: formatearFecha(actividad.fecha, idioma),
    hora_inicio: actividad.dia_completo
      ? etiquetaDiaCompleto
      : formatearHora(actividad.hora_inicio),
    hora_fin: actividad.dia_completo
      ? etiquetaDiaCompleto
      : formatearHora(actividad.hora_fin),
    lugar: actividad.lugar || '',
    enlace_conexion: actividad.enlace_conexion || '',
    enlace_agenda: baseUrl ? `${baseUrl.replace(/\/+$/, '')}/alumno/agenda` : '',
  };
}
