/**
 * Slice `compartido` — `Resultado<T, E>` (Requisito 17.1).
 *
 * Los servicios de los slices de capacidad devuelven `Resultado` en lugar de lanzar.
 * Así el route handler decide el código HTTP en un único punto y no hay `try/catch`
 * anidados repartidos por el código.
 *
 * Sobre la dependencia con `./errores`: es un `import type`, así que desaparece al
 * compilar y no crea acoplamiento en tiempo de ejecución. Tampoco hay ciclo dentro
 * del slice, porque `errores.ts` no conoce `resultado.ts`: la arista es una sola y va
 * en un único sentido (`resultado -> errores`).
 */
import type { ErrorAgenda } from './errores';

/**
 * Éxito o fallo tipado, como unión discriminada por `ok`. `E` tiene `ErrorAgenda`
 * como valor por defecto porque es el error de todos los servicios de la agenda; un
 * servicio con otro tipo de error lo declara explícitamente.
 */
export type Resultado<T, E = ErrorAgenda> =
  | { ok: true; valor: T }
  | { ok: false; error: E };

/** Constructor del caso de éxito. */
export function ok<T>(valor: T): { ok: true; valor: T } {
  return { ok: true, valor };
}

/** Constructor del caso de fallo. */
export function fallo<E = ErrorAgenda>(error: E): { ok: false; error: E } {
  return { ok: false, error };
}
