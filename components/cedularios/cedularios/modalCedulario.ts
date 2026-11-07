/**
 * `ced_modal` values owned by the cedularios components.
 *
 * `CedularioList` reads `ced_modal` (through `useCedulariosUrl`) and renders `CedularioForm` when it is
 * `nuevo-cedulario` or `editar-cedulario:<id>`. The detail view can open the same edit form with
 * `modalEditarCedulario(id)`. Other values are ignored by this folder.
 */

export const MODAL_NUEVO_CEDULARIO = 'nuevo-cedulario';
/** Opens the import-from-file dialog (ImportarCedularioDialog). */
export const MODAL_IMPORTAR_CEDULARIO = 'importar-cedulario';

const PREFIJO_EDITAR = 'editar-cedulario:';

export function modalEditarCedulario(id: string): string {
  return `${PREFIJO_EDITAR}${id}`;
}

/** Cedulario id of an `editar-cedulario:<id>` value, or null for any other value. */
export function idDeModalEditarCedulario(modal: string | null): string | null {
  if (modal === null || !modal.startsWith(PREFIJO_EDITAR)) return null;
  const id = modal.slice(PREFIJO_EDITAR.length);
  return id.length > 0 ? id : null;
}
