'use client';

/**
 * Light shell of the student hover card (Req 18, 19).
 *
 * It only imports the generic `HoverCard`, the role rule and the role from the user
 * store. The card content (summary query, buttons, URL writes) lives in
 * `AlumnoHoverCardContenido`, loaded with `next/dynamic` and mounted only while the
 * card is open, so N closed cards issue zero tracking queries.
 *
 * For alumno, lector, unknown roles or a missing student it renders the same
 * container the caller had before (`<div className>` with the children): no Popover,
 * no queries and no listeners.
 */

import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { HoverCard } from '@/components/common/HoverCard';
import { hoverCardActivo } from '@/lib/cedularios/seguimiento/permisos';
import { useUserStore } from '@/stores/useUserStore';
import type { UserRol } from '@/lib/supabase/types';
import type { AlumnoHoverCardContenidoProps } from './AlumnoHoverCardContenido';

/** Basic data of the student that the caller already has on screen. */
export interface AlumnoHoverCardAlumno {
  id: string;
  nombre: string;
  apellido: string;
  apellido_materno?: string | null;
  email: string;
  avatar_url?: string | null;
}

export interface AlumnoHoverCardProps {
  alumno: AlumnoHoverCardAlumno | null | undefined;
  /** Avatar and name of the caller, unchanged. They are the trigger. */
  children: ReactNode;
  /** The classes the original container had. */
  className?: string;
}

/** Placeholder while the content chunk loads; keeps the card from collapsing. */
function ContenidoCargando() {
  return (
    <div
      aria-busy="true"
      className="h-24 w-72 max-w-full animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-bg-secondary)]"
    />
  );
}

const AlumnoHoverCardContenido = dynamic<AlumnoHoverCardContenidoProps>(
  () => import('./AlumnoHoverCardContenido').then((modulo) => modulo.AlumnoHoverCardContenido),
  { ssr: false, loading: () => <ContenidoCargando /> },
);

function AlumnoHoverCardActiva({
  alumno,
  children,
  className,
}: {
  alumno: AlumnoHoverCardAlumno;
  children: ReactNode;
  className?: string;
}) {
  const t = useTranslations('cedularios.seguimiento.hover');
  const nombre = `${alumno.nombre} ${alumno.apellido}`.trim();

  return (
    <HoverCard
      ariaLabel={t('aria', { nombre })}
      className={className}
      content={({ close, lockSide }) => (
        <AlumnoHoverCardContenido alumno={alumno} close={close} fijarLado={lockSide} />
      )}
    >
      {children}
    </HoverCard>
  );
}

export function AlumnoHoverCard({ alumno, children, className }: AlumnoHoverCardProps) {
  // Same source as the rest of the app, without the auth listener of `useUser`.
  const rol = useUserStore((estado) => (estado.user?.rol ?? null) as UserRol | null);

  if (!alumno || !hoverCardActivo(rol)) {
    return <div className={className}>{children}</div>;
  }

  return (
    <AlumnoHoverCardActiva alumno={alumno} className={className}>
      {children}
    </AlumnoHoverCardActiva>
  );
}
