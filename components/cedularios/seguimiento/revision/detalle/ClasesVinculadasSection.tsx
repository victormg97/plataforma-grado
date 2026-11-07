'use client';

/**
 * "Clases vinculadas" section of the materia detail panel.
 *
 * - Each link shows the class title and date (date-fns, locale `es`) and a "cancelada" tag when
 *   the class has `activo = false`. The link is kept even when the class is cancelled.
 * - Admin and profesor: a click goes to the class detail route of their role. The current URL
 *   is passed as the way back, so the Revisor opens again on return.
 * - Alumno: plain text, no navigation and no actions.
 * - Edit mode: "Vincular clases" opens the picker dialog, and every link can be removed. Only
 *   the link is removed, never the class.
 */

import { useId, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link2, Unlink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/common/Button';
import { cn } from '@/lib/utils';
import { rutaDetalleClase } from '@/lib/cedularios/seguimiento/rutas';
import type { ClaseVinculadaDetalle } from '@/lib/queries/cedularios/seguimiento/progreso';
import { esIdTemporal, useDetalleMutations } from '../../hooks/useDetalleMutations';
import { useSegRol } from '../../hooks/useSegRol';
import { VincularClasesDialog } from './VincularClasesDialog';

/** 'yyyy-MM-dd' shown with the `es` locale; null or unparseable values give an empty string. */
function formatearFechaClase(valor: string | null): string {
  if (!valor) return '';
  const fecha = parseISO(valor);
  return isValid(fecha) ? format(fecha, 'd MMM yyyy', { locale: es }) : '';
}

interface ClasesVinculadasSectionProps {
  /** Id of the assignment that owns the progress row. */
  asignacionId: string;
  /** Id of the progress row of the materia. */
  progresoId: string;
  /** Links of the materia, as loaded in the detail. */
  clases: readonly ClaseVinculadaDetalle[];
  /** True in edit mode; false renders the links without link/unlink actions. */
  editable: boolean;
  className?: string;
}

export function ClasesVinculadasSection({
  asignacionId,
  progresoId,
  clases,
  editable,
  className,
}: ClasesVinculadasSectionProps) {
  const t = useTranslations('cedularios.seguimiento.detalle.clases');
  const idBase = useId();
  const { isAdmin, isProfesor } = useSegRol();
  const { desvincularClase } = useDetalleMutations(asignacionId, progresoId);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [dialogoAbierto, setDialogoAbierto] = useState(false);

  // Only admin and profesor have a class detail route; the alumno sees plain text.
  const rolRuta = isAdmin ? 'admin' : isProfesor ? 'profesor' : null;
  const consulta = searchParams?.toString() ?? '';
  const desde = `${pathname ?? ''}${consulta ? `?${consulta}` : ''}`;

  return (
    <section className={cn('flex flex-col gap-3', className)} aria-labelledby={`${idBase}-titulo`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
          <h4
            id={`${idBase}-titulo`}
            className="text-sm font-semibold text-[var(--color-text-primary)]"
          >
            {t('titulo')}
          </h4>
          <span className="text-xs text-[var(--color-text-muted)]">
            {t('conteo', { count: clases.length })}
          </span>
        </div>
        {editable && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<Link2 className="size-4" aria-hidden="true" />}
            onClick={() => setDialogoAbierto(true)}
          >
            {t('vincular')}
          </Button>
        )}
      </div>

      {clases.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">{t('vacio')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {clases.map((clase) => {
            const titulo = clase.titulo?.trim() ? clase.titulo : t('sin_titulo');
            const fecha = formatearFechaClase(clase.fecha);
            const temporal = esIdTemporal(clase.id);
            const desvinculando =
              desvincularClase.isPending && desvincularClase.variables?.id === clase.id;

            const contenido = (
              <>
                <span
                  className={cn(
                    'min-w-0 truncate text-sm font-medium text-[var(--color-text-primary)]',
                    !clase.activo && 'text-[var(--color-text-muted)]',
                  )}
                >
                  {titulo}
                </span>
                {fecha && (
                  <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                    {t('fecha_clase', { fecha })}
                  </span>
                )}
                {!clase.activo && (
                  <span className="shrink-0 rounded-[var(--radius-sm)] border border-[var(--color-error)] px-1.5 py-0.5 text-xs text-[var(--color-error)]">
                    {t('cancelada')}
                  </span>
                )}
              </>
            );

            return (
              <li
                key={clase.id}
                className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-2"
              >
                {rolRuta && !temporal ? (
                  <Link
                    href={rutaDetalleClase(rolRuta, clase.horarioId, desde)}
                    aria-label={t('ir_a_clase', { titulo })}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-sm)] px-1 py-1 outline-none hover:bg-[var(--color-bg)] focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)]/40"
                  >
                    {contenido}
                  </Link>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center gap-2 px-1 py-1">
                    {contenido}
                  </div>
                )}
                {editable && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-8 shrink-0 px-0"
                    aria-label={t('desvincular_aria', { titulo })}
                    title={t('desvincular')}
                    disabled={temporal || desvinculando}
                    onClick={() => desvincularClase.mutate({ id: clase.id })}
                  >
                    <Unlink className="size-4" aria-hidden="true" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editable && dialogoAbierto && (
        <VincularClasesDialog
          open
          onClose={() => setDialogoAbierto(false)}
          asignacionId={asignacionId}
          progresoId={progresoId}
          horarioIdsVinculados={clases.map((clase) => clase.horarioId)}
        />
      )}
    </section>
  );
}
