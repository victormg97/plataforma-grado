'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/common/Button';
import { contarCedulariosActivosPorUniversidad } from '@/lib/queries/cedularios/cedularios';
import type { Universidad } from '@/lib/queries/cedularios/universidades';
import { useCedulariosUrl } from '../hooks/CedulariosUrlContext';
import { codigoDeError } from '../hooks/cedulariosQuery';
import { useCedularios } from '../hooks/useCedularios';
import { useCedulariosUsuario } from '../hooks/useCedulariosUsuario';
import { useUniversidades } from '../hooks/useUniversidades';
import { EliminarUniversidadDialog } from './EliminarUniversidadDialog';
import {
  MODAL_NUEVA_UNIVERSIDAD,
  idDeModalEditarUniversidad,
  modalEditarUniversidad,
} from './modalUniversidad';
import { puedeGestionarUniversidad } from './permisosUniversidad';
import { UniversidadCard } from './UniversidadCard';
import { UniversidadForm } from './UniversidadForm';

const ESQUELETOS = [0, 1, 2, 3, 4, 5] as const;
const CLASE_GRILLA = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3';

function UniversidadListSkeleton({ etiqueta }: { etiqueta: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={etiqueta} className={CLASE_GRILLA}>
      {ESQUELETOS.map((i) => (
        <div
          key={i}
          className="flex animate-pulse items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-[var(--space-sm)]"
        >
          <div className="size-14 shrink-0 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)]" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-4 w-3/4 rounded bg-[var(--color-bg-secondary)]" />
            <div className="h-3 w-1/3 rounded bg-[var(--color-bg-secondary)]" />
            <div className="h-3 w-1/2 rounded bg-[var(--color-bg-secondary)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Grid of universidades (Requirements 1.11, 1.12, 11.1, 11.11).
 *
 * Owns the create/edit form and the delete dialog. The form is driven by the `ced_modal` URL value
 * (`nueva-universidad` or `editar-universidad:<id>`, see `modalUniversidad.ts`) so it survives a
 * reload. The delete dialog is local state: it is a transient confirmation.
 */
export function UniversidadList() {
  const t = useTranslations('cedularios');
  const usuario = useCedulariosUsuario();
  const { modal, setModal } = useCedulariosUrl();
  const universidadesQuery = useUniversidades();
  const cedulariosQuery = useCedularios();
  const [aEliminar, setAEliminar] = useState<Universidad | null>(null);

  const universidades = universidadesQuery.data;
  const cedularios = cedulariosQuery.data;

  // Admin sees active and inactive universidades; everyone else only active ones (RLS decides, this
  // is a second guard).
  const visibles = useMemo(
    () => (universidades ?? []).filter((u) => usuario.isAdmin || u.activo),
    [universidades, usuario.isAdmin],
  );

  const conteos = useMemo(
    () => (cedularios ? contarCedulariosActivosPorUniversidad(cedularios) : null),
    [cedularios],
  );

  const abrirNueva = modal === MODAL_NUEVA_UNIVERSIDAD;
  const idEditando = idDeModalEditarUniversidad(modal);
  const editando = idEditando !== null ? (visibles.find((u) => u.id === idEditando) ?? null) : null;

  // A shared URL can carry a modal the user may not open: close it (Requirement 1.13).
  const usuarioListo = usuario.rol !== null;
  const listasCargadas = universidades !== undefined;
  const modalInvalido =
    usuarioListo &&
    listasCargadas &&
    ((abrirNueva && !usuario.isStaff) ||
      (idEditando !== null && (editando === null || !puedeGestionarUniversidad(usuario, editando))));

  useEffect(() => {
    if (modalInvalido) setModal(null);
  }, [modalInvalido, setModal]);

  const formularioAbierto = !modalInvalido && (abrirNueva || editando !== null);

  if (universidadesQuery.isPending) {
    return (
      <section className="flex flex-col gap-4">
        <UniversidadListSkeleton etiqueta={t('comun.cargando')} />
      </section>
    );
  }

  if (universidadesQuery.isError) {
    return (
      <section className="flex flex-col items-center gap-3 py-10 text-center" role="alert">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {t(`errores.${codigoDeError(universidadesQuery.error)}`)}
        </p>
        <Button type="button" variant="secondary" size="sm" onClick={() => void universidadesQuery.refetch()}>
          {t('comun.reintentar')}
        </Button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t('universidades.titulo')}</h3>
          <p className="text-sm text-[var(--color-text-muted)]">{t('universidades.subtitulo')}</p>
        </div>
        {usuario.isStaff && (
          <Button
            type="button"
            size="sm"
            icon={<Plus className="size-4" aria-hidden="true" />}
            onClick={() => setModal(MODAL_NUEVA_UNIVERSIDAD)}
          >
            {t('universidades.nueva')}
          </Button>
        )}
      </div>

      {visibles.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-4 py-12 text-center">
          <Building2 className="size-10 text-[var(--color-text-muted)]" aria-hidden="true" />
          <p className="font-medium text-[var(--color-text-primary)]">{t('universidades.vacio')}</p>
          <p className="max-w-md text-sm text-[var(--color-text-muted)]">
            {usuario.isStaff ? t('universidades.vacio_descripcion') : t('universidades.vacio_lector')}
          </p>
        </div>
      ) : (
        <ul className={CLASE_GRILLA}>
          {visibles.map((universidad) => (
            <li key={universidad.id} className="min-w-0">
              <UniversidadCard
                universidad={universidad}
                cedulariosActivos={conteos ? (conteos.get(universidad.id) ?? 0) : null}
                onEdit={(u) => setModal(modalEditarUniversidad(u.id))}
                onDelete={setAEliminar}
              />
            </li>
          ))}
        </ul>
      )}

      {formularioAbierto && (
        <UniversidadForm
          key={modal ?? MODAL_NUEVA_UNIVERSIDAD}
          universidad={editando}
          onClose={() => setModal(null)}
        />
      )}

      {aEliminar !== null && (
        <EliminarUniversidadDialog
          key={aEliminar.id}
          universidad={aEliminar}
          onClose={() => setAEliminar(null)}
        />
      )}
    </section>
  );
}
