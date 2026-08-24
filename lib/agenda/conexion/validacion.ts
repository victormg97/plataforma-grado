/**
 * Slice `conexion` — validación del Enlace_Conexion (Requisitos 10.7, 10.8, 11.3, 11.4, 11.5).
 *
 * Regla transversal: el mismo contrato lo consumen los esquemas de Clases
 * (`lib/validations/horario.schema.ts`), los de Entradas_Personales y los de
 * Actividades (Requisito 11.2). Por eso vive en su propio slice y no dentro de
 * `nucleo`: ninguna de las tres capacidades es dueña de la regla.
 *
 * Este archivo no produce texto de interfaz (Requisito 15.1): los mensajes de los
 * dos fallos son `CodigoErrorAgenda`, que es justo lo que `desdeZod` del slice
 * `compartido` lee del primer issue para construir el `ErrorAgenda`. El rótulo que
 * ve el usuario lo resuelve next-intl a partir de ese código.
 *
 * Dependencias: `zod`. Nada del proyecto salvo, si hiciera falta, `compartido`
 * (Requisito 17.3).
 */
import { z } from 'zod';

/**
 * Tope de longitud del Enlace_Conexion (Requisitos 1.1, 10.12, 11.5).
 *
 * Es el mismo número que las restricciones `horarios_enlace_conexion_len` y
 * `agenda_eventos_enlace_len` de la base de datos: Zod rechaza con un 400 legible
 * antes de que Postgres tenga que levantar una violación de `CHECK`.
 */
export const LIMITE_ENLACE = 2000;

/**
 * `true` cuando el valor es una URL absoluta con esquema `http` o `https`
 * (Requisitos 10.8, 11.4).
 *
 * Se delega en `new URL`, que es el mismo analizador que usará el navegador al abrir
 * el enlace, en lugar de una expresión regular propia. Quedan fuera las rutas
 * relativas y las cadenas que no son URL (`new URL` lanza) y también los esquemas
 * absolutos que sí parsean pero no son navegables ni seguros: `ftp:`, `mailto:`,
 * `data:` y, sobre todo, `javascript:`, que en un `href` sería ejecución de código.
 */
export function esEnlaceConexionValido(valor: string): boolean {
  try {
    const url = new URL(valor);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Enlace_Conexion opcional, normalizado a `string | null`.
 *
 * Ausente, nulo, cadena vacía y cadena de solo espacios son válidos y salen como
 * `null` (Requisitos 10.7, 11.3); el valor no vacío sale recortado.
 *
 * **El orden de la cadena importa.** `.max` va antes del `.refine` de formato para
 * que una cadena de 2.001 caracteres falle con `enlace_excede` (Requisito 11.5) y no
 * con `enlace_invalido` (Requisito 11.4): los dos son 400, pero identifican
 * problemas distintos y el usuario necesita saber cuál corregir.
 *
 * El `.transform` final colapsa `undefined` en `null` para que los tres casos vacíos
 * lleguen a la base de datos como el mismo valor. La clave sigue siendo opcional
 * dentro de un `z.object`, porque el esquema mantiene su entrada opcional.
 */
export const enlaceConexionSchema = z
  .string()
  .max(LIMITE_ENLACE, { error: 'enlace_excede' })
  .transform((v) => (v.trim() === '' ? null : v.trim()))
  .nullish()
  .refine((v) => v === null || v === undefined || esEnlaceConexionValido(v), {
    error: 'enlace_invalido',
  })
  .transform((v) => v ?? null);

/** Salida del esquema: nunca `undefined`. */
export type EnlaceConexion = z.output<typeof enlaceConexionSchema>;
