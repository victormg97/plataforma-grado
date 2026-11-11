'use client';

/**
 * Profile-style card of a professor or admin for the admin "Profesores" page.
 * Header banner + overlapping avatar, identity, student count and the action buttons
 * (edit, enable/disable, students, classes, cedulario). Entrance and hover animations
 * respect `prefers-reduced-motion`.
 */

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { m, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { CalendarDays, ClipboardList, Eye, Pencil, UserCheck, UserX, Users } from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Tooltip } from '@/components/common/Tooltip';
import { cn } from '@/lib/utils';

export interface ProfesorCardData {
  id: string;
  nombre: string;
  apellido: string;
  apellido_materno?: string | null;
  email: string;
  avatar_url: string | null;
  activo: boolean;
  rol: string;
  /** Hex colour the user picked for the calendar (profile); null uses the brand colour. */
  color_calendario?: string | null;
  alumnos_count: number;
  estado_cuenta?: 'Pendiente' | 'Activo';
}

interface ProfesorCardProps {
  profesor: ProfesorCardData;
  /** Position inside its section; staggers the entrance. */
  indice: number;
  /** "Asignar cedulario" or "Revisar cedulario(s)", already translated. */
  etiquetaCedulario: string;
  onEditar: () => void;
  onToggleActivo: () => void;
  onCedulario: () => void;
}

const CLASE_ACCION =
  'flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent-border)] hover:bg-[var(--color-accent-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-gold)]';

export function ProfesorCard({
  profesor: p,
  indice,
  etiquetaCedulario,
  onEditar,
  onToggleActivo,
  onCedulario,
}: ProfesorCardProps) {
  const tp = useTranslations('profesores');
  const tc = useTranslations('common');
  const reducir = useReducedMotion();
  const esAdmin = p.rol === 'admin';
  const nombre = [p.nombre, p.apellido, p.apellido_materno].filter(Boolean).join(' ');

  return (
    <m.article
      style={{ '--pc': p.color_calendario ?? 'var(--color-brand-gold)' } as CSSProperties}
      initial={reducir ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: reducir ? 0 : Math.min(indice, 8) * 0.05, ease: 'easeOut' }}
      whileHover={reducir ? undefined : { y: -4 }}
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-lg,0.75rem)] border border-[var(--color-border)]',
        'bg-[var(--color-card,var(--color-bg))] shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-gold)]',
        !esAdmin && !p.activo && 'opacity-80',
      )}
    >
      {/* Banner */}
      <div
        aria-hidden="true"
        className={cn(
          'h-20',
          // Gradient of the colour the user chose for the calendar (--pc); lighter in light mode,
          // deeper in dark mode so the strip does not glare.
          'bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.35),transparent_55%),linear-gradient(135deg,color-mix(in_srgb,var(--pc)_95%,white),color-mix(in_srgb,var(--pc)_55%,white))]',
          'dark:bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.10),transparent_55%),linear-gradient(135deg,color-mix(in_srgb,var(--pc)_70%,black),color-mix(in_srgb,var(--pc)_28%,black))]',
        )}
      />

      {/* Top-right quick actions */}
      <div className="absolute right-2 top-2 flex items-center gap-1">
        {!esAdmin && (
          <Tooltip content={p.activo ? tp('deshabilitar') : tp('habilitar')}>
            <button
              type="button"
              onClick={onToggleActivo}
              aria-label={p.activo ? tp('deshabilitar') : tp('habilitar')}
              className={cn(
                'rounded-full bg-[var(--color-bg)]/85 p-1.5 backdrop-blur transition-colors hover:bg-[var(--color-bg)]',
                p.activo ? 'text-[var(--color-error)]' : 'text-[var(--color-success)]',
              )}
            >
              {p.activo ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
            </button>
          </Tooltip>
        )}
        <Tooltip content={tc('editar')}>
          <button
            type="button"
            onClick={onEditar}
            aria-label={tc('editar')}
            className="rounded-full bg-[var(--color-bg)]/85 p-1.5 text-[var(--color-text-primary)] backdrop-blur transition-colors hover:bg-[var(--color-bg)]"
          >
            <Pencil className="size-4" />
          </button>
        </Tooltip>
      </div>

      {/* Identity */}
      <div className="relative z-10 -mt-10 flex flex-col items-center gap-1 px-[var(--space-md)] text-center">
        <Avatar
          nombre={p.nombre}
          apellido={p.apellido}
          avatarUrl={p.avatar_url}
          size="xl"
          className="ring-4 ring-[var(--color-bg)] shadow-[var(--shadow-md)] transition-transform duration-300 group-hover:scale-105"
        />
        <h3 className="mt-2 max-w-full truncate text-base font-semibold text-[var(--color-text-primary)]">
          {nombre}
        </h3>
        {esAdmin ? (
          <span className="rounded-full bg-[var(--color-accent-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-accent-fg)]">
            Admin
          </span>
        ) : (
          <StatusBadge
            status={p.estado_cuenta === 'Pendiente' ? 'pendiente' : p.activo ? 'activo' : 'inactivo'}
          />
        )}
        <p className="max-w-full truncate text-sm text-[var(--color-text-muted)]" title={p.email}>
          {p.email}
        </p>
        <p className="mt-1 flex items-center gap-1.5 rounded-full bg-[var(--color-bg-secondary)] px-3 py-1 text-xs text-[var(--color-text-muted)]">
          <Users className="size-3.5" aria-hidden="true" />
          {tp('alumnos_asignados', { count: p.alumnos_count })}
        </p>
      </div>

      {/* Actions */}
      <div className="mt-auto grid grid-cols-2 gap-2 p-[var(--space-md)] pt-[var(--space-md)]">
        <Link href={`/admin/alumnos?profesor_id=${p.id}`} className={CLASE_ACCION}>
          <Eye className="size-3.5" aria-hidden="true" />
          {tp('ver_alumnos')}
        </Link>
        <Link href={`/admin/profesores/${p.id}/horarios`} className={CLASE_ACCION}>
          <CalendarDays className="size-3.5" aria-hidden="true" />
          {tp('ver_clases')}
        </Link>
        <button type="button" onClick={onCedulario} className={cn(CLASE_ACCION, 'col-span-2')}>
          <ClipboardList className="size-3.5" aria-hidden="true" />
          {etiquetaCedulario}
        </button>
      </div>
    </m.article>
  );
}
