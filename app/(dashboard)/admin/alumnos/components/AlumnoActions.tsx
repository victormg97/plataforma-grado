'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Pencil, ArrowRight, GraduationCap, UserX, UserCheck } from 'lucide-react';
import { Tooltip } from '@/components/common/Tooltip';

export type AlumnoAdmin = {
  id: string;
  nombre: string;
  apellido: string;
  apellido_materno?: string | null;
  email: string;
  telefono: string | null;
  avatar_url: string | null;
  activo: boolean;
  profesor_id: string | null;
  profesor: { id: string; nombre: string; apellido: string } | null;
  universidad: string | null;
  año_ingreso: string | null;
  notas: string | null;
  paso_prueba: boolean;
  fecha_prueba: string | null;
  estado_cuenta?: 'Pendiente' | 'Activo';
  estado: 'activo' | 'pendiente' | 'bloqueado' | 'graduado';
};

interface AlumnoActionsProps {
  alumno: AlumnoAdmin;
  onReassign: (alumno: AlumnoAdmin) => void;
  onGraduate: (alumno: AlumnoAdmin) => void;
  onToggleBlock: (alumno: AlumnoAdmin) => void;
}

export function AlumnoActions({ alumno, onReassign, onGraduate, onToggleBlock }: AlumnoActionsProps) {
  const router = useRouter();
  const tc = useTranslations('common');
  const ta = useTranslations('alumnos');

  // Graduación visible solo si activo y no graduado
  const canGraduate = !alumno.paso_prueba && alumno.activo;

  return (
    <div className="flex items-center gap-1 w-[112px] justify-end">
      <Tooltip content={tc('editar')}>
        <button
          onClick={() => router.push(`/admin/alumnos/${alumno.id}/editar`)}
          className="cursor-pointer rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
        >
          <Pencil className="size-4" />
        </button>
      </Tooltip>
      <Tooltip content={ta('reasignar_titulo')}>
        <button
          onClick={() => onReassign(alumno)}
          className="cursor-pointer rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]"
        >
          <ArrowRight className="size-4" />
        </button>
      </Tooltip>
      {canGraduate && (
        <Tooltip content={ta('graduar_titulo')}>
          <button
            onClick={() => onGraduate(alumno)}
            className="cursor-pointer rounded p-1.5 text-[var(--color-brand-gold)] hover:bg-[var(--color-brand-gold-muted)]"
          >
            <GraduationCap className="size-4" />
          </button>
        </Tooltip>
      )}
      <Tooltip content={alumno.activo ? ta('bloquear') : ta('desbloquear')}>
        <button
          onClick={() => onToggleBlock(alumno)}
          className={`cursor-pointer rounded p-1.5 ${alumno.activo ? 'text-[var(--color-error)] hover:bg-[var(--color-error)]/5' : 'text-[var(--color-success)] hover:bg-[var(--color-success)]/5'}`}
        >
          {alumno.activo ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
        </button>
      </Tooltip>
    </div>
  );
}
