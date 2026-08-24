/**
 * Slice `nucleo` — modelo de la agenda (Requisitos 1.9, 8.10, 17.1, 17.2).
 *
 * Este archivo solo declara tipos: no contiene lógica ni valores en tiempo de
 * ejecución. Es el vocabulario que comparten los slices de capacidad, la API_Agenda y
 * los calendarios, de modo que la forma de un Evento_Agenda se define una sola vez.
 *
 * Dependencias: `@/lib/agenda/compartido` (nivel 0) y `@/lib/supabase/types`
 * (Requisito 17.3). Nada más.
 */
import type { ConflictoAgenda, CuerpoErrorAgenda } from '@/lib/agenda/compartido';
import type {
  AgendaAlcance,
  AgendaVisibilidad,
  CategoriaAgenda,
  UserRol,
} from '@/lib/supabase/types';

/**
 * Los cuatro tipos de elemento que pueden ocupar tiempo en la agenda de un usuario:
 * las Clases y los Bloqueos_Horario preexistentes, más las Entradas_Personales y las
 * Actividades de esta funcionalidad.
 *
 * Se deriva de `ConflictoAgenda['tipo']` en lugar de repetir la unión: `compartido`
 * ya la necesita para `respuestaError` y no puede importar `nucleo`, así que la única
 * forma de tener una sola definición estructural es aliar sobre ella.
 */
export type TipoElementoAgenda = ConflictoAgenda['tipo'];

/**
 * El subconjunto de `TipoElementoAgenda` que corresponde a un Evento_Agenda. Se
 * deriva por `Extract` para que renombrar un valor rompa la compilación aquí.
 */
export type TipoEventoAgenda = Extract<
  TipoElementoAgenda,
  'entrada_personal' | 'actividad'
>;

/** Autor de un Evento_Agenda, tal y como lo muestra el detalle (Requisito 8.10). */
export interface AutorResumen {
  id: string;
  nombre: string;
  apellido: string;
  rol: UserRol;
}

/**
 * Campos de un Evento_Agenda que **todo** lector autorizado puede ver, con
 * independencia de su relación con el Autor (Requisito 8.10).
 *
 * `descripcion` y `nota` no están aquí a propósito: viven solo en la variante de
 * lectura completa.
 */
export interface EventoAgendaBase {
  id: string;
  /** Derivado de `alcance`: `personal` es una Entrada_Personal; el resto, Actividad. */
  tipo: TipoEventoAgenda;
  titulo: string;
  categoria: CategoriaAgenda;
  alcance: AgendaAlcance;
  visibilidad: AgendaVisibilidad;
  /** `YYYY-MM-DD`. Un Evento_Agenda vive en una única fecha (Requisito 10.11). */
  fecha: string;
  /** `HH:MM`, ya normalizado desde el `HH:MM:SS` de Postgres. */
  hora_inicio: string;
  /** `HH:MM`, ya normalizado desde el `HH:MM:SS` de Postgres. */
  hora_fin: string;
  dia_completo: boolean;
  lugar: string | null;
  enlace_conexion: string | null;
  autor: AutorResumen;
  /** Requisito 12.5: controles de edición y eliminación, resueltos en el servidor. */
  puede_editar: boolean;
  /** Requisito 9.3: solo relevante para el Alumno lector de una Actividad. */
  oculto: boolean;
}

/**
 * Lectura completa: el lector es el Autor, o es un Destinatario_Vigente de la
 * Actividad. Es la única variante que declara `descripcion` y `nota`.
 */
export interface EventoAgendaPropio extends EventoAgendaBase {
  lectura: 'completa';
  descripcion: string | null;
  nota: string | null;
}

/**
 * Lectura parcial (Requisito 8.10): **no declara** `descripcion` ni `nota`.
 *
 * La ausencia de las propiedades —y no un `null` ni un opcional— es lo que hace
 * imposible por tipos exponer la nota de una Entrada_Personal ajena: `evento.nota`
 * no compila mientras el lector no haya estrechado la unión a `'completa'`.
 */
export interface EventoAgendaAjeno extends EventoAgendaBase {
  lectura: 'parcial';
}

/**
 * DTO de lectura de la agenda: una unión discriminada por `lectura`, no un objeto
 * con campos opcionales.
 */
export type EventoAgendaProyectado = EventoAgendaPropio | EventoAgendaAjeno;

/** Intervalo de fechas que presenta la vista activa de un calendario. */
export interface RangoVisible {
  /** `YYYY-MM-DD`, inclusive. */
  desde: string;
  /** `YYYY-MM-DD`, inclusive. */
  hasta: string;
}

/**
 * Elemento en conflicto que la API_Agenda devuelve como advertencia no bloqueante
 * (Requisitos 6.7, 7.2) o dentro del 409 (Requisito 6.2).
 *
 * Alias de `ConflictoAgenda`: la definición vive en `compartido` porque
 * `respuestaError` la necesita y `compartido` no puede importar `nucleo`. El alias
 * conserva el nombre del diseño sin duplicar la estructura.
 */
export type AdvertenciaSolapamiento = ConflictoAgenda;

/**
 * Envoltura común de toda respuesta de éxito de escritura de la API_Agenda.
 *
 * `advertencias` es siempre un array —vacío cuando no hay conflicto (Requisito
 * 7.5)—, de modo que el cliente no tiene que distinguir «sin conflicto» de «campo
 * ausente».
 */
export interface RespuestaEscrituraAgenda<T> {
  data: T;
  advertencias: AdvertenciaSolapamiento[];
  /** Presente solo en las respuestas del slice `actividades` (Requisito 13.9). */
  correo_intentado?: boolean;
}

/**
 * Cuerpo de toda respuesta de error de la API_Agenda. Alias de `CuerpoErrorAgenda`,
 * por el mismo motivo que `AdvertenciaSolapamiento`: `respuestaError` lo construye
 * desde `compartido`, así que la definición no puede vivir aquí.
 *
 * El cliente nunca muestra `error.codigo`: resuelve `error.mensajeKey` con next-intl
 * (Requisitos 15.1, 15.5).
 */
export type ErrorAgendaBody = CuerpoErrorAgenda;
