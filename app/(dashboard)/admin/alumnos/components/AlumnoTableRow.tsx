'use client';

import { Avatar } from '@/components/common/Avatar';
import { StatusBadge } from '@/components/common/StatusBadge';
import { LastAccessBadge } from '@/components/common/LastAccessBadge';
import { AlumnoActions, type AlumnoAdmin } from './AlumnoActions';

type AlumnoStatus = 'pendiente' | 'bloqueado' | 'graduado' | 'activo';

interface AlumnoTableRowProps {
  alumno: AlumnoAdmin;
  status: AlumnoStatus;
  onOpen: (id: string) => void;
  onReassign: (alumno: AlumnoAdmin) => void;
  onGraduate: (alumno: AlumnoAdmin) => void;
  onToggleBlock: (alumno: AlumnoAdmin) => void;
}

export function AlumnoTableRow({
  alumno,
  status,
  onOpen,
  onReassign,
  onGraduate,
  onToggleBlock,
}: AlumnoTableRowProps) {
  return (
    <tr
      className="cursor-pointer border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)] transition-colors"
      onClick={() => onOpen(alumno.id)}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar nombre={alumno.nombre} apellido={alumno.apellido} avatarUrl={alumno.avatar_url} size="sm" />
          <div>
            <p className="font-medium text-[var(--color-text-primary)]">
              {alumno.nombre} {[alumno.apellido, alumno.apellido_materno].filter(Boolean).join(' ')}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">{alumno.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {alumno.profesor ? (
          <span className="text-[var(--color-text-primary)]">{alumno.profesor.nombre} {alumno.profesor.apellido}</span>
        ) : (
          <span className="text-[var(--color-text-muted)]">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={status} />
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <LastAccessBadge dateStr={alumno.last_sign_in_at} />
      </td>
      <td className="px-4 py-3 hidden xl:table-cell text-[var(--color-text-muted)]">
        {alumno.universidad || '—'}
      </td>
      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <AlumnoActions
            alumno={alumno}
            onReassign={onReassign}
            onGraduate={onGraduate}
            onToggleBlock={onToggleBlock}
          />
        </div>
      </td>
    </tr>
  );
}
