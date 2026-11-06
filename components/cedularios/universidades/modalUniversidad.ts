/**
 * `ced_modal` values owned by the universidades components.
 *
 * `UniversidadList` reads `ced_modal` (through `useCedulariosUrl`) and renders the form when it is
 * `nueva-universidad` or `editar-universidad:<id>`. Other values are ignored by this folder.
 */

export const MODAL_NUEVA_UNIVERSIDAD = 'nueva-universidad';

const PREFIJO_EDITAR = 'editar-universidad:';

export function modalEditarUniversidad(id: string): string {
  return `${PREFIJO_EDITAR}${id}`;
}

/** Universidad id of an `editar-universidad:<id>` value, or null for any other value. */
export function idDeModalEditarUniversidad(modal: string | null): string | null {
  if (modal === null || !modal.startsWith(PREFIJO_EDITAR)) return null;
  const id = modal.slice(PREFIJO_EDITAR.length);
  return id.length > 0 ? id : null;
}
