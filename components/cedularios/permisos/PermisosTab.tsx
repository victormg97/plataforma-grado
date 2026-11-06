'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { UserMinus, UserPlus } from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { ConfirmModal } from '@/components/common/ConfirmModal';
import type { Colaborador } from '@/lib/queries/cedularios/permisos';
import { usePermisos, useRevocarPermiso } from '../hooks/usePermisos';
import { useCedulariosAction } from '../hooks/useCedulariosAction';
import { AddColaboradorDialog } from './AddColaboradorDialog';

export interface PermisosTabProps {
  cedularioId: string;
  /** `created_by` of the cedulario; null when the creator no longer exists. */
  creadorId: string | null;
  /** Display name of the creator, when known. */
  creadorNombre?: string;
  /** Admin or creator (`usePermisosCedulario().puedeGestionar`). Collaborators never see the actions. */
  puedeGestionar: boolean;
}

function formatearFecha(iso: string): string | null {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  return format(fecha, 'd MMM yyyy', { locale: es });
}

function dividirNombre(nombreCompleto: string): { nombre: string; apellido: string } {
  const [nombre = '', ...resto] = nombreCompleto.trim().split(/\s+/);
  return { nombre, apellido: resto.join(' ') };
}

/**
 * Permisos tab of a cedulario: the creator, the collaborators, and (only when `puedeGestionar`)
 * the actions to add and remove collaborators (Req 6.2, 6.3, 6.7, 6.11, 6.12, 11.9).
 */
export function PermisosTab({ cedularioId, creadorId, creadorNombre, puedeGestionar }: PermisosTabProps) {
  const t = useTranslations('cedularios');
  const { translateError } = useCedulariosAction();

  const colaboradores = usePermisos(cedularioId);
  const revocar = useRevocarPermiso();

  const [agregarAbierto, setAgregarAbierto] = useState(false);
  const [aQuitar, setAQuitar] = useState<Colaborador | null>(null);

  const lista = colaboradores.data ?? [];
  const mostrarCreador = creadorId !== null || Boolean(creadorNombre);
  const nombreCreador = creadorNombre?.trim() || t('usuario_desconocido');
  const creador = dividirNombre(nombreCreador);

  const handleConfirmarQuitar = async () => {
    if (!aQuitar) return;
    const resultado = await revocar.mutateAsync({ cedularioId, profesorId: aQuitar.id });
    // On error the toast is shown by the hook and the dialog stays open to retry or cancel.
    if (resultado.ok) setAQuitar(null);
  };

  return (
    <section className="space-y-4" aria-labelledby={`permisos-titulo-${cedularioId}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2
            id={`permisos-titulo-${cedularioId}`}
            className="text-lg font-semibold text-[var(--color-text-primary)]"
          >
            {t('permisos.titulo')}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">{t('permisos.descripcion')}</p>
        </div>
        {puedeGestionar && (
          <Button
            variant="primary"
            size="sm"
            icon={<UserPlus className="size-4" aria-hidden />}
            onClick={() => setAgregarAbierto(true)}
          >
            {t('permisos.agregar')}
          </Button>
        )}
      </div>

      {mostrarCreador && (
        <ul className="space-y-2">
          <li className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
            <Avatar nombre={creador.nombre} apellido={creador.apellido} size="sm" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-text-primary)]">
              {nombreCreador}
            </span>
            <span className="shrink-0 rounded-full bg-[var(--color-brand-gold-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-brand-gold)]">
              {t('permisos.creador')}
            </span>
          </li>
        </ul>
      )}

      <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">
        {t('permisos.colaboradores')}
      </h3>

      {colaboradores.isPending && (
        <div className="space-y-2" role="status" aria-label={t('permisos.cargando')}>
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)]"
            />
          ))}
          <span className="sr-only">{t('permisos.cargando')}</span>
        </div>
      )}

      {colaboradores.isError && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-[var(--color-error)]" role="alert">
            {translateError({ code: colaboradores.error.code })}
          </p>
          <Button variant="secondary" size="sm" onClick={() => void colaboradores.refetch()}>
            {t('comun.reintentar')}
          </Button>
        </div>
      )}

      {colaboradores.isSuccess && lista.length === 0 && (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] p-6 text-center">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            {puedeGestionar ? t('permisos.vacio') : t('permisos.vacio_lector')}
          </p>
          {puedeGestionar && (
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {t('permisos.vacio_descripcion')}
            </p>
          )}
        </div>
      )}

      {lista.length > 0 && (
        <ul className="space-y-2">
          {lista.map((colaborador) => {
            const nombreCompleto = `${colaborador.nombre} ${colaborador.apellido}`.trim();
            const fecha = formatearFecha(colaborador.createdAt);
            return (
              <li
                key={colaborador.id}
                className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3"
              >
                <Avatar nombre={colaborador.nombre} apellido={colaborador.apellido} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                    {nombreCompleto}
                  </p>
                  {fecha && (
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {t('permisos.agregado_el', { fecha })}
                    </p>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
                  {t('permisos.colaborador')}
                </span>
                {puedeGestionar && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    aria-label={t('permisos.quitar_aria', { nombre: nombreCompleto })}
                    title={t('permisos.quitar')}
                    onClick={() => setAQuitar(colaborador)}
                  >
                    <UserMinus className="size-4" aria-hidden />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {puedeGestionar && agregarAbierto && (
        <AddColaboradorDialog
          cedularioId={cedularioId}
          open={agregarAbierto}
          onClose={() => setAgregarAbierto(false)}
        />
      )}

      {puedeGestionar && (
        <ConfirmModal
          open={aQuitar !== null}
          onClose={() => {
            if (!revocar.isPending) setAQuitar(null);
          }}
          onConfirm={() => void handleConfirmarQuitar()}
          title={t('permisos.dialogo_quitar.titulo')}
          description={t('permisos.dialogo_quitar.descripcion', {
            nombre: aQuitar ? `${aQuitar.nombre} ${aQuitar.apellido}`.trim() : '',
          })}
          confirmText={t('permisos.dialogo_quitar.confirmar')}
          cancelText={t('comun.cancelar')}
          loading={revocar.isPending}
          isDanger
        />
      )}
    </section>
  );
}
