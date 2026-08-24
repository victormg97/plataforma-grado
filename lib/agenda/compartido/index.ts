/**
 * `Punto_Entrada_Slice` del slice `compartido` (Requisito 17.3).
 *
 * Solo reexportaciones: ninguna lógica y ninguna importación del proyecto. Es el
 * nivel 0 del grafo de slices, así que cualquier slice puede depender de él sin
 * riesgo de ciclo (Requisito 17.4) y sin arrastrar código de servidor al paquete del
 * cliente.
 */
export { normalizarHora, aMinutos, RANGO_DIA_COMPLETO, formatearRango } from './tiempo';

export {
  ErrorAgenda,
  esErrorAgenda,
  aEstadoHttp,
  mensajeKeyError,
  desdeZod,
  desdeErrorPostgrest,
  parsearConflictosPostgrest,
  cuerpoError,
  respuestaError,
  NAMESPACE_ERROR_POR_DEFECTO,
  type CodigoErrorAgenda,
  type ConflictoAgenda,
  type CuerpoErrorAgenda,
  type ErrorPostgrestParcial,
  type OpcionesErrorAgenda,
  type OpcionesDesdeZod,
} from './errores';

export { ok, fallo, type Resultado } from './resultado';
