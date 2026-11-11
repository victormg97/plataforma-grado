'use client';

/**
 * Profile-style card of an alumno for the admin list. The banner, border, avatar and animation
 * change with the account status: graduado (gold, shine sweep), bloqueado (striped, grayscale),
 * pendiente (dashed) and activo (accent gradient). Shows the last access, the active cedulario
 * state ("Asignar cedulario" when none) and the same actions the table had.
 */

import { format } from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';
import { m, useReducedMotion } from 'framer-motion';
import { ClipboardList, GraduationCap, Lock, School, UserRound } from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { StatusBadge } from '@/components/common/StatusBadge';
import { UltimoAcceso } from '@/components/alumnos/UltimoAcceso';
import { AlumnoHoverCard } from '@/components/cedularios/seguimiento/hover/AlumnoHoverCard';
import { cn } from '@/lib/utils';
import { AlumnoActions, type AlumnoAdmin } from './AlumnoActions';
import { ESTILO_ESTADO, type AlumnoStatus } from './estiloEstado';

interface AlumnoProfileCardProps {
  alumno: AlumnoAdmin;
  status: AlumnoStatus;
  /** Position inside its section; staggers the entrance. */
  indice: number;
  /** Active cedulario assignments of the alumno. */
  cedularios: number;
  onOpen: (id: string) => void;
  onCedulario: (alumno: AlumnoAdmin, cedularios: number) => void;
  onReassign: (alumno: AlumnoAdmin) => void;
  onGraduate: (alumno: AlumnoAdmin) => void;
  onToggleBlock: (alumno: AlumnoAdmin) => void;
}

/** Light sweep across the gold banner of graduated alumnos. */
function BrilloGraduado({ reducir }: { reducir: boolean | null }) {
  if (reducir) return null;
  return (
    <m.span
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/50 to-transparent"
      initial={{ x: '0%' }}
      animate={{ x: '420%' }}
      transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity, repeatDelay: 3.2 }}
    />
  );
}

export function AlumnoProfileCard({
  alumno,
  status,
  indice,
  cedularios,
  onOpen,
  onCedulario,
  onReassign,
  onGraduate,
  onToggleBlock,
}: AlumnoProfileCardProps) {
  const ta = useTranslations('alumnos');
  const locale = useLocale();
  const reducir = useReducedMotion();
  const estilo = ESTILO_ESTADO[status];
  const nombre = [alumno.nombre, alumno.apellido, alumno.apellido_materno].filter(Boolean).join(' ');
  const graduado = status === 'graduado';
  const bloqueado = status === 'bloqueado';

  return (
    <m.article
      initial={reducir ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: reducir ? 0 : Math.min(indice, 8) * 0.05, ease: 'easeOut' }}
      whileHover={reducir ? undefined : { y: -4 }}
      onClick={() => onOpen(alumno.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(alumno.id); }
      }}
      className={cn(
        'group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--color-card,var(--color-bg))] shadow-[var(--shadow-sm)] transition-shadow',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-gold)]',
        estilo.tarjeta,
      )}
    >
      {/* Banner */}
      <div aria-hidden="true" className={cn('relative h-16 overflow-hidden', estilo.banner)}>
        {graduado && <BrilloGraduado reducir={reducir} />}
      </div>

      {/* Status chip over the banner */}
      <div className="absolute left-3 top-3 flex items-center gap-1.5">
        <StatusBadge status={status} className="bg-[var(--color-bg)]/90 backdrop-blur" />
      </div>

      {/* Status emblem */}
      {graduado && (
        <m.div
          aria-hidden="true"
          className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-[var(--color-bg)] text-[var(--color-brand-gold)] shadow-[var(--shadow-gold)]"
          animate={reducir ? undefined : { y: [0, -3, 0], rotate: [0, -6, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <GraduationCap className="size-4.5" />
        </m.div>
      )}
      {bloqueado && (
        <div
          aria-hidden="true"
          className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-[var(--color-bg)] text-[var(--color-error)] shadow-[var(--shadow-sm)]"
        >
          <Lock className="size-4" />
        </div>
      )}

      {/* Identity */}
      <div className="relative z-10 -mt-9 flex flex-col items-center gap-1 px-[var(--space-md)] text-center">
        <AlumnoHoverCard alumno={alumno} className="flex flex-col items-center gap-1">
          <Avatar
            nombre={alumno.nombre}
            apellido={alumno.apellido}
            avatarUrl={alumno.avatar_url}
            size="xl"
            className={cn('shadow-[var(--shadow-md)] transition-transform duration-300 group-hover:scale-105', estilo.avatar)}
          />
          <h3
            className={cn(
              'mt-1 max-w-full truncate text-base font-semibold text-[var(--color-text-primary)]',
              bloqueado && 'text-[var(--color-text-secondary)]',
            )}
          >
            {nombre}
          </h3>
        </AlumnoHoverCard>
        <p className="max-w-full truncate text-sm text-[var(--color-text-muted)]" title={alumno.email}>
          {alumno.email}
        </p>
        {bloqueado && (
          <p className="text-xs font-medium text-[var(--color-error)]">{ta('bloqueado_aviso')}</p>
        )}
        {graduado && alumno.fecha_prueba && (
          <p className="text-xs font-medium text-[var(--color-accent-fg)]">
            {ta('fecha_graduacion', {
              fecha: format(new Date(`${alumno.fecha_prueba}T12:00:00`), locale === 'en' ? 'MMM d, yyyy' : "d MMM yyyy", {
                locale: locale === 'en' ? enUS : es,
              }),
            })}
          </p>
        )}
      </div>

      {/* Details */}
      <div className="mt-3 flex flex-col gap-2 px-[var(--space-md)]">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-muted)]">
          <span className="inline-flex min-w-0 items-center gap-1">
            <UserRound className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {alumno.profesor ? `${alumno.profesor.nombre} ${alumno.profesor.apellido}` : '—'}
            </span>
          </span>
          {alumno.universidad && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <School className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{alumno.universidad}</span>
            </span>
          )}
        </div>
        <UltimoAcceso dateStr={alumno.last_sign_in_at} />
      </div>

      {/* Cedulario state + action */}
      <div className="mt-3 px-[var(--space-md)]" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => onCedulario(alumno, cedularios)}
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-left text-xs font-medium transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-gold)]',
            cedularios > 0
              ? 'border-[var(--color-accent-border)] bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] hover:brightness-95'
              : 'border-dashed border-[var(--color-border-strong,var(--color-border))] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]',
          )}
        >
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <ClipboardList className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {cedularios > 0 ? ta('cedulario_activo', { count: cedularios }) : ta('sin_cedulario')}
            </span>
          </span>
          <span className="shrink-0 font-semibold">
            {cedularios > 0 ? ta('revisar_cedularios', { count: cedularios }) : ta('asignar_cedulario')}
          </span>
        </button>
      </div>

      {/* Actions */}
      <div
        className="mt-auto flex justify-center px-[var(--space-sm)] pb-[var(--space-sm)] pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex w-full justify-center border-t border-[var(--color-border)] pt-2">
          <AlumnoActions
            alumno={alumno}
            className="w-auto justify-center"
            onReassign={onReassign}
            onGraduate={onGraduate}
            onToggleBlock={onToggleBlock}
          />
        </div>
      </div>
    </m.article>
  );
}
