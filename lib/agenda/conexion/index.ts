/**
 * `Punto_Entrada_Slice` del slice `conexion` (Requisito 17.3).
 *
 * Solo reexportaciones. Los consumidores —`entradas-personales`, `actividades` y el
 * esquema de horarios de `lib/validations/`— importan siempre desde
 * `@/lib/agenda/conexion`, nunca desde `./validacion`.
 *
 * El componente `BotonConexion` no se reexporta aquí: es un `'use client'` y sacarlo
 * por este punto de entrada arrastraría React a cualquier ruta de servidor que solo
 * quiere validar un enlace.
 */
export {
  esEnlaceConexionValido,
  enlaceConexionSchema,
  LIMITE_ENLACE,
  type EnlaceConexion,
} from './validacion';
