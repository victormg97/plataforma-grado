'use client';

import { useCallback, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronsDownUp, ChevronsUpDown, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { MAX_NIVEL, puedeCrearHijo, type FilaVisible } from '@/lib/cedularios/tree';
import { useCedulariosAction } from '../hooks/useCedulariosAction';
import { useMateriasTree } from '../hooks/useMaterias';
import { useEliminarMateriaFlujo } from './MateriaDelete';
import { MateriaForm, type MateriaCreada } from './MateriaForm';
import { MateriaInlineEdit } from './MateriaInlineEdit';
import type { MateriaTreeHandle } from './MateriaTree';
import { MateriaTreeEditable } from './MateriaTreeEditable';
import type { MateriaTreeRowProps } from './MateriaTreeRow';

type FormularioAbierto = { tipo: 'crear'; parentId: string | null } | { tipo: 'editar'; id: string };

export interface MateriaAcciones {
  /** Opens the form to add a root materia. */
  abrirCrear: () => void;
  /** Opens the form to add a child of `parentId`. Rejected with `errores.nivel_maximo` at nivel 5. */
  abrirHija: (parentId: string) => void;
  /** Opens the edit form (código, nombre, descripción and temario) of a materia. */
  abrirEditar: (id: string) => void;
  /** Starts the delete flow: immediate without active descendants, confirmation otherwise, then the undo toast. */
  solicitarEliminar: (id: string) => void;
  /** A deletion request is in flight. */
  eliminando: boolean;
  /** Handle of the tree these actions belong to. `EstructuraEditable` attaches it to its tree. */
  arbolRef: RefObject<MateriaTreeHandle | null>;
  /**
   * The form modal and the delete confirmation. Render it exactly once, anywhere inside the
   * `CedulariosUrlProvider` (when `EstructuraEditable` is used without `acciones` it renders them itself).
   */
  dialogos: ReactNode;
}

/**
 * Edit actions on the materias of a cedulario, shared by the tree rows (`EstructuraEditable`) and
 * any other place that needs them, such as the Edit and Delete buttons of `MateriaPanel`
 * (`extraActions`). Dialog state is local to the host (not in the URL). After a child is created
 * its parent is expanded through the tree handle.
 */
export function useMateriaAcciones(cedularioId: string): MateriaAcciones {
  const { showError } = useCedulariosAction();
  const { data: flat } = useMateriasTree(cedularioId);
  const arbolRef = useRef<MateriaTreeHandle>(null);
  const [formulario, setFormulario] = useState<FormularioAbierto | null>(null);
  const eliminacion = useEliminarMateriaFlujo(cedularioId);
  const { solicitarEliminar, eliminando } = eliminacion;

  const abrirCrear = useCallback(() => setFormulario({ tipo: 'crear', parentId: null }), []);
  const abrirEditar = useCallback((id: string) => setFormulario({ tipo: 'editar', id }), []);

  const abrirHija = useCallback(
    (parentId: string) => {
      const permitido = puedeCrearHijo(flat ?? [], parentId);
      if (!permitido.ok) {
        showError({ code: permitido.razon === 'nivel_maximo' ? 'nivel_maximo' : 'padre_invalido' });
        return;
      }
      setFormulario({ tipo: 'crear', parentId });
    },
    [flat, showError],
  );

  const cerrarFormulario = useCallback(() => setFormulario(null), []);

  const alCrear = useCallback(
    (creada: MateriaCreada) => {
      // Reveal the new child: its parent starts collapsed.
      if (creada.parentId !== null) arbolRef.current?.expandir(creada.parentId);
    },
    [],
  );

  const dialogos = (
    <>
      {formulario && (
        <MateriaForm
          key={formulario.tipo === 'editar' ? `editar:${formulario.id}` : `crear:${formulario.parentId ?? 'raiz'}`}
          cedularioId={cedularioId}
          materiaId={formulario.tipo === 'editar' ? formulario.id : null}
          parentId={formulario.tipo === 'crear' ? formulario.parentId : null}
          onClose={cerrarFormulario}
          onCreada={alCrear}
        />
      )}
      {eliminacion.dialogo}
    </>
  );

  return { abrirCrear, abrirHija, abrirEditar, solicitarEliminar, eliminando, arbolRef, dialogos };
}

export interface EstructuraEditableProps {
  cedularioId: string;
  /**
   * Actions created by the parent with `useMateriaAcciones(cedularioId)`, so that other parts of the
   * screen (the Edit and Delete buttons of `MateriaPanel`) open the same dialogs. The parent then
   * renders `acciones.dialogos`. Omit it to let this component manage its own actions and dialogs.
   */
  acciones?: MateriaAcciones;
}

/**
 * Editable materia tree: drag and drop and the row menu (task 10.7) plus the "Add materia" button,
 * inline edit of código and nombre, and the Edit, Add child and Delete entries of the row menu
 * (Requirements 4.2 to 4.6, 4.15, 4.16, 11.5, 12.1 to 12.3, 12.8 to 12.14, 15.1, 15.3).
 *
 * Only for users who can edit; read-only users get the plain `MateriaTree`.
 */
export function EstructuraEditable({ cedularioId, acciones }: EstructuraEditableProps) {
  if (acciones) return <EstructuraConAcciones cedularioId={cedularioId} acciones={acciones} />;
  return <EstructuraAutonoma cedularioId={cedularioId} />;
}

function EstructuraAutonoma({ cedularioId }: { cedularioId: string }) {
  const acciones = useMateriaAcciones(cedularioId);
  return (
    <>
      <EstructuraConAcciones cedularioId={cedularioId} acciones={acciones} />
      {acciones.dialogos}
    </>
  );
}

/**
 * Menu entry that expands or collapses a whole branch. Mounted only while the row menu is open, so
 * it reads the current expansion of the subtree on demand: it offers Collapse all when the materia
 * and everything below it is expanded, and Expand all otherwise.
 */
function ItemExpansionTotal({ id, arbolRef }: { id: string; arbolRef: RefObject<MateriaTreeHandle | null> }) {
  const t = useTranslations('cedularios');
  // Read once, when the menu opens. The tree handle is set long before (this component only mounts
  // with the open menu) and the expansion lives in the tree's state, not in a prop, so a ref read is needed.
  // eslint-disable-next-line react-hooks/refs
  const [todoExpandido] = useState(() => arbolRef.current?.subarbolExpandido(id) ?? false);
  const Icono = todoExpandido ? ChevronsDownUp : ChevronsUpDown;
  return (
    <DropdownMenuItem
      data-accion={todoExpandido ? 'contraer-todo' : 'expandir-todo'}
      onClick={() => (todoExpandido ? arbolRef.current?.contraerTodo(id) : arbolRef.current?.expandirTodo(id))}
    >
      <Icono aria-hidden="true" />
      {todoExpandido ? t('estructura.contraer_todo') : t('estructura.expandir_todo')}
    </DropdownMenuItem>
  );
}

function EstructuraConAcciones({ cedularioId, acciones }: { cedularioId: string; acciones: MateriaAcciones }) {
  const t = useTranslations('cedularios');
  const { abrirCrear, abrirHija, abrirEditar, solicitarEliminar, arbolRef } = acciones;

  const renderContenido = useCallback(
    (fila: FilaVisible, propsFila: MateriaTreeRowProps) => (
      <MateriaInlineEdit cedularioId={cedularioId} fila={fila} propsFila={propsFila} />
    ),
    [cedularioId],
  );

  const accionesExtra = useCallback(
    (fila: FilaVisible) => (
      <>
        {fila.tieneHijos && <ItemExpansionTotal id={fila.nodo.id} arbolRef={arbolRef} />}
        <DropdownMenuItem data-accion="editar" onClick={() => abrirEditar(fila.nodo.id)}>
          <Pencil aria-hidden="true" />
          {t('estructura.editar')}
        </DropdownMenuItem>
        <DropdownMenuItem
          data-accion="agregar-hija"
          disabled={fila.nodo.nivel >= MAX_NIVEL}
          onClick={() => abrirHija(fila.nodo.id)}
        >
          <Plus aria-hidden="true" />
          {t('estructura.agregar_hija')}
        </DropdownMenuItem>
        <DropdownMenuItem data-accion="eliminar" variant="destructive" onClick={() => solicitarEliminar(fila.nodo.id)}>
          <Trash2 aria-hidden="true" />
          {t('estructura.eliminar')}
        </DropdownMenuItem>
      </>
    ),
    [abrirEditar, abrirHija, solicitarEliminar, arbolRef, t],
  );

  return (
    <MateriaTreeEditable
      ref={arbolRef}
      cedularioId={cedularioId}
      accionesToolbar={
        <Button type="button" size="sm" icon={<Plus aria-hidden="true" />} onClick={abrirCrear}>
          {t('estructura.agregar_materia')}
        </Button>
      }
      renderContenido={renderContenido}
      accionesExtra={accionesExtra}
    />
  );
}
