'use client';

import { Avatar } from '@/components/common/Avatar';
import { StatusBadge } from '@/components/common/StatusBadge';
import { AlumnoActions, type AlumnoAdmin } from './AlumnoActions';

type AlumnoStatus = 'pendiente' | 'bloqueado' | 'graduado' | 'activo';

interface AlumnoMobileCardProps {
  alumno: AlumnoAdmin;
  status: AlumnoStatus;
  onOpen: (id: string) => void;
  onReassign: (alumno: AlumnoAdmin) => void;
  onGraduate: (alumno: AlumnoAdmin) => void;
  onToggleBlock: (alumno: AlumnoAdmin) => void;
}

export function AlumnoMobileCard({
  alumno,
  status,
  onOpen,
  onReassign,
  onGraduate,
  onToggleBlock,
}: AlumnoMobileCardProps) {
  return (
    <div
      className="cursor-pointer rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-[var(--space-md)] transition-colors hover:bg-[var(--color-bg-secondary)]"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(alumno.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(alumno.id); } }}
    >
      {/* Info row */}
      <div className="flex items-center gap-3">
        <Avatar nombre={alumno.nombre} apellido={alumno.apellido} avatarUrl={alumno.avatar_url} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-[var(--color-text-primary)] truncate">{alumno.nombre} {[alumno.apellido, alumno.apellido_materno].filter(Boolean).join(' ')}</p>
          <p className="text-xs text-[var(--color-text-muted)] truncate">{alumno.email}</p>
          {alumno.profesor && (
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              Prof. {alumno.profesor.nombre} {alumno.profesor.apellido}
            </p>
          )}
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Actions row */}
      <div
        className="mt-[var(--space-sm)] flex items-center justify-end gap-1 border-t border-[var(--color-border)] pt-[var(--space-sm)]"
        role="group"
        onClick={(e) => e.stopPropagation()}
      >
        <AlumnoActions
          alumno={alumno}
          onReassign={onReassign}
          onGraduate={onGraduate}
          onToggleBlock={onToggleBlock}
        />
      </div>
    </div>
  );
}
