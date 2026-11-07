'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { format, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Building2, ChevronRight, FileText, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AppSelect } from '@/components/common/AppSelect';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { SEARCH_MAX_LENGTH, filtrarCedularios, type CedularioListItem } from '@/lib/cedularios/busqueda';
import { cn } from '@/lib/utils';
import { useCedulariosUrl } from '../hooks/CedulariosUrlContext';
import { codigoDeError } from '../hooks/cedulariosQuery';
import { useCedularios } from '../hooks/useCedularios';
import { useCedulariosUsuario } from '../hooks/useCedulariosUsuario';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useUniversidades } from '../hooks/useUniversidades';
import { CedularioForm } from './CedularioForm';
import { useEliminarCedularioFlujo } from './DeleteCedularioDialog';
import {
  MODAL_NUEVO_CEDULARIO,
  idDeModalEditarCedulario,
  modalEditarCedulario,
} from './modalCedulario';
import { puedeGestionarCedularioDe } from './permisosCedulario';

const ESQUELETOS = [0, 1, 2, 3, 4, 5] as const;
const VALOR_TODAS = '';

const CLASE_ACCION =
  'flex size-8 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)] disabled:pointer-events-none disabled:opacity-50';

function CedularioListSkeleton({ etiqueta }: { etiqueta: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={etiqueta} className="flex flex-col gap-3">
      {ESQUELETOS.map((i) => (
        <div
          key={i}
          className="flex animate-pulse items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-[var(--space-sm)]"
        >
          <div className="size-10 shrink-0 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)]" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-4 w-2/3 rounded bg-[var(--color-bg-secondary)]" />
            <div className="h-3 w-1/3 rounded bg-[var(--color-bg-secondary)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function formatearFecha(iso: string): string | null {
  const fecha = new Date(iso);
  return isValid(fecha) ? format(fecha, 'dd/MM/yyyy', { locale: es }) : null;
}

interface CedularioItemProps {
  cedulario: CedularioListItem;
  mostrarUniversidad: boolean;
  puedeGestionar: boolean;
  eliminando: boolean;
  eliminacionBloqueada: boolean;
  onOpen: (cedulario: CedularioListItem) => void;
  onEdit: (cedulario: CedularioListItem) => void;
  onDelete: (cedulario: CedularioListItem) => void;
}

function CedularioItem({
  cedulario,
  mostrarUniversidad,
  puedeGestionar,
  eliminando,
  eliminacionBloqueada,
  onOpen,
  onEdit,
  onDelete,
}: CedularioItemProps) {
  const t = useTranslations('cedularios');
  const usuario = useCedulariosUsuario();
  const fecha = formatearFecha(cedulario.updated_at);
  const mostrarInactivo = usuario.isAdmin && !cedulario.activo;

  return (
    <Card
      hover
      padding="none"
      className={cn('group flex h-full items-stretch overflow-hidden', !cedulario.activo && 'opacity-70')}
    >
      <button
        type="button"
        onClick={() => onOpen(cedulario)}
        aria-label={t('cedularios.seleccionar_aria', { nombre: cedulario.nombre })}
        className="flex min-w-0 flex-1 items-center gap-4 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-brand-gold)]"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)]">
          <FileText className="size-6" aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          {mostrarUniversidad && cedulario.universidadNombre !== '' && (
            <span className="flex items-center gap-1.5 truncate text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              <Building2 className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{cedulario.universidadNombre}</span>
            </span>
          )}
          <span className="line-clamp-2 text-base font-semibold leading-snug text-[var(--color-text-primary)]">
            {cedulario.nombre}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-text-muted)]">
            <span className="rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-0.5 font-medium text-[var(--color-text-secondary)]">
              {cedulario.version.trim() !== '' ? t('cedularios.version', { version: cedulario.version }) : t('cedularios.sin_version')}
            </span>
            {fecha !== null && <span>{t('cedularios.actualizado', { fecha })}</span>}
            {mostrarInactivo && (
              <span className="rounded-full border border-[var(--color-border)] px-2.5 py-0.5 font-medium">
                {t('cedularios.inactivo')}
              </span>
            )}
          </span>
        </span>
        {!puedeGestionar && (
          <ChevronRight
            className="size-5 shrink-0 text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        )}
      </button>

      {puedeGestionar && (
        <div
          className="flex shrink-0 flex-col items-center justify-center gap-1 border-l border-[var(--color-border)] px-2"
          role="group"
          aria-label={t('comun.acciones')}
        >
          <button
            type="button"
            onClick={() => onEdit(cedulario)}
            aria-label={`${t('cedularios.editar')}: ${cedulario.nombre}`}
            title={t('cedularios.editar')}
            className={cn(CLASE_ACCION, 'hover:text-[var(--color-text-primary)]')}
          >
            <Pencil className="size-4" aria-hidden="true" />
          </button>
          {cedulario.activo && (
            <button
              type="button"
              onClick={() => onDelete(cedulario)}
              disabled={eliminacionBloqueada}
              aria-busy={eliminando}
              aria-label={`${t('cedularios.eliminar')}: ${cedulario.nombre}`}
              title={eliminando ? t('comun.eliminando') : t('cedularios.eliminar')}
              className={cn(CLASE_ACCION, 'hover:text-[var(--color-error)]', eliminando && 'animate-pulse')}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * Cedularios of the selected universidad, or of every universidad when none is selected
 * (Requirements 2.16, 11.2, 14.1 to 14.5, 14.12).
 *
 * Owns the search field (typed text updates at once, the filter and `ced_q` follow after 300 ms),
 * the universidad filter (`ced_filtro_uni`), the create/edit form (driven by `ced_modal`, see
 * `modalCedulario.ts`) and the delete flow. Selecting a cedulario clears `ced_q`, because the
 * materias search of the detail view shares that parameter.
 */
export function CedularioList() {
  const t = useTranslations('cedularios');
  const usuario = useCedulariosUsuario();
  const {
    universidadId,
    q,
    filtroUniversidadId,
    modal,
    setUniversidadId,
    setCedularioId,
    setQ,
    setFiltroUniversidadId,
    setModal,
  } = useCedulariosUrl();
  const cedulariosQuery = useCedularios();
  const universidadesQuery = useUniversidades();
  const { solicitarEliminacion, evaluandoId, dialogo } = useEliminarCedularioFlujo();

  // Search: the input follows the keystrokes; filtering and the URL follow after the debounce.
  const [texto, setTexto] = useState(q.slice(0, SEARCH_MAX_LENGTH));
  const textoAplicado = useDebouncedValue(texto);
  const ultimoAplicado = useRef(textoAplicado);
  useEffect(() => {
    if (ultimoAplicado.current === textoAplicado) return;
    ultimoAplicado.current = textoAplicado;
    setQ(textoAplicado);
  }, [textoAplicado, setQ]);

  const cedularios = cedulariosQuery.data;

  // Admin sees active and inactive cedularios; everyone else only active ones (RLS decides, this is
  // a second guard).
  const visibles = useMemo(
    () => (cedularios ?? []).filter((c) => usuario.isAdmin || c.activo),
    [cedularios, usuario.isAdmin],
  );

  const delAmbito = useMemo(
    () => (universidadId === null ? visibles : visibles.filter((c) => c.universidadId === universidadId)),
    [visibles, universidadId],
  );

  // Universidades with at least one visible cedulario, in list order.
  const opcionesUniversidad = useMemo(() => {
    const vistas = new Map<string, string>();
    for (const c of visibles) if (!vistas.has(c.universidadId)) vistas.set(c.universidadId, c.universidadNombre);
    return [...vistas.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [visibles]);

  // A stale filter value (universidad without visible cedularios) is ignored.
  const filtroEfectivo =
    universidadId === null &&
    filtroUniversidadId !== null &&
    opcionesUniversidad.some((o) => o.value === filtroUniversidadId)
      ? filtroUniversidadId
      : null;

  const filtrados = useMemo(
    () => filtrarCedularios(delAmbito, textoAplicado, filtroEfectivo),
    [delAmbito, textoAplicado, filtroEfectivo],
  );

  const hayFiltros = textoAplicado.trim() !== '' || filtroEfectivo !== null;

  // Form driven by ced_modal. A shared URL can carry a modal the user may not open: close it.
  const abrirNuevo = modal === MODAL_NUEVO_CEDULARIO;
  const idEditando = idDeModalEditarCedulario(modal);
  const editando = idEditando !== null ? (visibles.find((c) => c.id === idEditando) ?? null) : null;
  const usuarioListo = usuario.rol !== null;
  const modalInvalido =
    usuarioListo &&
    cedularios !== undefined &&
    ((abrirNuevo && !usuario.isStaff) ||
      (idEditando !== null && (editando === null || !puedeGestionarCedularioDe(usuario, editando.createdBy))));

  useEffect(() => {
    if (modalInvalido) setModal(null);
  }, [modalInvalido, setModal]);

  const formularioAbierto = !modalInvalido && (abrirNuevo || editando !== null);

  const nombreUniversidad =
    universidadId !== null
      ? (universidadesQuery.data?.find((u) => u.id === universidadId)?.nombre ??
        delAmbito[0]?.universidadNombre ??
        null)
      : null;

  const abrir = (cedulario: CedularioListItem) => {
    // The materias search of the detail shares ced_q: start it empty.
    setQ('');
    setCedularioId(cedulario.id);
  };

  const volver = () => {
    setTexto('');
    setQ('');
    setFiltroUniversidadId(null);
    setUniversidadId(null);
  };

  if (cedulariosQuery.isPending) {
    return (
      <section className="flex flex-col gap-4">
        <CedularioListSkeleton etiqueta={t('comun.cargando')} />
      </section>
    );
  }

  if (cedulariosQuery.isError) {
    return (
      <section className="flex flex-col items-center gap-3 py-10 text-center" role="alert">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {t(`errores.${codigoDeError(cedulariosQuery.error)}`)}
        </p>
        <Button type="button" variant="secondary" size="sm" onClick={() => void cedulariosQuery.refetch()}>
          {t('comun.reintentar')}
        </Button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      {universidadId !== null && (
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={<ArrowLeft className="size-4" aria-hidden="true" />}
            onClick={volver}
          >
            {t('cedularios.volver_universidades')}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {nombreUniversidad !== null ? t('cedularios.titulo_universidad', { universidad: nombreUniversidad }) : t('cedularios.titulo')}
          </h3>
        </div>
        {usuario.isStaff && (
          <Button
            type="button"
            size="sm"
            icon={<Plus className="size-4" aria-hidden="true" />}
            onClick={() => setModal(MODAL_NUEVO_CEDULARIO)}
          >
            {t('cedularios.nuevo')}
          </Button>
        )}
      </div>

      {delAmbito.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-muted)]"
              aria-hidden="true"
            />
            <input
              type="text"
              value={texto}
              onChange={(e) => setTexto(e.target.value.slice(0, SEARCH_MAX_LENGTH))}
              maxLength={SEARCH_MAX_LENGTH}
              placeholder={t('cedularios.buscar_placeholder')}
              aria-label={t('cedularios.buscar_aria')}
              autoComplete="off"
              className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] pl-9 pr-9 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:ring-2 focus:ring-[var(--color-brand-gold)]/20"
            />
            {texto !== '' && (
              <button
                type="button"
                onClick={() => setTexto('')}
                aria-label={t('comun.limpiar')}
                className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {universidadId === null && opcionesUniversidad.length > 0 && (
            <div className="sm:w-64" aria-label={t('cedularios.filtro_universidad_aria')}>
              <AppSelect
                value={filtroEfectivo ?? VALOR_TODAS}
                onChange={(valor) => setFiltroUniversidadId(valor === VALOR_TODAS ? null : valor)}
                options={[{ value: VALOR_TODAS, label: t('cedularios.filtro_todas') }, ...opcionesUniversidad]}
                placeholder={t('cedularios.filtro_universidad')}
                className="h-10 w-full"
              />
            </div>
          )}
        </div>
      )}

      {delAmbito.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-4 py-12 text-center">
          <FileText className="size-10 text-[var(--color-text-muted)]" aria-hidden="true" />
          <p className="font-medium text-[var(--color-text-primary)]">
            {universidadId !== null ? t('cedularios.vacio_universidad') : t('cedularios.vacio')}
          </p>
          <p className="max-w-md text-sm text-[var(--color-text-muted)]">
            {usuario.isStaff ? t('cedularios.vacio_descripcion') : t('cedularios.vacio_lector')}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-[var(--color-text-secondary)]" role="status" aria-live="polite">
            {hayFiltros ? t('cedularios.resultados', { count: filtrados.length }) : t('cedularios.cantidad', { count: filtrados.length })}
          </p>

          {filtrados.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-4 py-10 text-center">
              <Search className="size-8 text-[var(--color-text-muted)]" aria-hidden="true" />
              <p className="text-sm text-[var(--color-text-muted)]">{t('cedularios.sin_resultados')}</p>
            </div>
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {filtrados.map((cedulario) => (
                <li key={cedulario.id} className="min-w-0">
                  <CedularioItem
                    cedulario={cedulario}
                    mostrarUniversidad={universidadId === null}
                    puedeGestionar={puedeGestionarCedularioDe(usuario, cedulario.createdBy)}
                    eliminando={evaluandoId === cedulario.id}
                    eliminacionBloqueada={evaluandoId !== null}
                    onOpen={abrir}
                    onEdit={(c) => setModal(modalEditarCedulario(c.id))}
                    onDelete={(c) => void solicitarEliminacion({ id: c.id, nombre: c.nombre })}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {formularioAbierto && (
        <CedularioForm
          key={modal ?? MODAL_NUEVO_CEDULARIO}
          cedularioId={editando?.id ?? null}
          universidadIdInicial={universidadId}
          onClose={() => setModal(null)}
        />
      )}

      {dialogo}
    </section>
  );
}
