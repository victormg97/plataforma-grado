'use client';

import Link from 'next/link';
import { m, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { GraduationCap } from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { Tooltip } from '@/components/common/Tooltip';
import { usePruebaTerm } from '@/lib/hooks/usePruebaTerm';
import { cn } from '@/lib/utils';
import type { HorarioConAsistencia } from '@/lib/hooks/useHorarios';

interface ClaseCardShellProps {
  indice: number;
  /** Highlighted card (the next class). */
  destacada?: boolean;
  onEdit: () => void;
  children: React.ReactNode;
}

/** Animated, clickable vertical card container shared by both tabs. */
export function ClaseCardShell({ indice, destacada = false, onEdit, children }: ClaseCardShellProps) {
  const reducir = useReducedMotion();
  return (
    <m.div
      initial={reducir ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: reducir ? 0 : Math.min(indice, 8) * 0.04, ease: 'easeOut' }}
      whileHover={reducir ? undefined : { y: -3 }}
      onClick={onEdit}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(); }
      }}
      className={cn(
        'group flex h-full cursor-pointer flex-col overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--color-bg)] shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-gold)]',
        destacada ? 'border-[var(--color-accent-border)] shadow-[var(--shadow-gold)]' : 'border-[var(--color-border)]',
      )}
    >
      <div
        aria-hidden="true"
        className={cn('h-1 w-full', destacada ? 'bg-[var(--color-brand-gold)]' : 'bg-[var(--color-border)]')}
      />
      {children}
    </m.div>
  );
}

interface AlumnoLinkProps {
  alumno: HorarioConAsistencia['alumno'];
  href: string;
}

/** Student row: avatar and a link to the student's file. */
export function ClaseAlumnoLink({ alumno, href }: AlumnoLinkProps) {
  const ta = useTranslations('alumnos');
  if (!alumno) {
    return <span className="font-semibold text-[var(--color-text-muted)]">—</span>;
  }
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar nombre={alumno.nombre} apellido={alumno.apellido} size="sm" className="shrink-0" />
      <Tooltip content={ta('ficha_titulo')} position="top">
        <Link
          href={href}
          onClick={(e) => e.stopPropagation()}
          className="min-w-0 truncate text-sm font-semibold text-[var(--color-text-primary)] underline decoration-dashed decoration-[var(--color-brand-gold)]/60 underline-offset-4 transition-colors hover:text-[var(--color-brand-gold)] hover:decoration-solid"
        >
          {alumno.nombre} {alumno.apellido}
        </Link>
      </Tooltip>
    </div>
  );
}

/** "Prueba" badge for classes linked to an exam. */
export function ClaseExamenBadge() {
  const t = useTranslations('horarios');
  const pruebaTerm = usePruebaTerm();
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-[var(--color-accent-border)] bg-[var(--color-accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-accent-fg)]">
      <GraduationCap className="size-2.5" />
      {t('badge_examen', { term: pruebaTerm.singular })}
    </span>
  );
}
