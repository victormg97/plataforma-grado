/**
 * `Punto_Entrada_Slice` del slice `visibilidad` (Requisito 17.3).
 *
 * La matriz de lectura, la proyección y los filtros de servidor.
 * Ningún archivo externo a este slice importa archivos internos directamente;
 * todo pasa por estas reexportaciones.
 *
 * Dependencias permitidas: `compartido`, `nucleo`.
 */
export { puedeLeerEntradaPersonal, puedeEditarEvento } from './matriz';
export type { ContextoLector } from './matriz';
export { proyectarEvento, proyectarEventos } from './proyeccion';
export type { EntradaProyeccion } from './proyeccion';
export {
  resolverContextoLector,
  filtroPorRol,
  type FiltroRol,
} from './filtros.servidor';
