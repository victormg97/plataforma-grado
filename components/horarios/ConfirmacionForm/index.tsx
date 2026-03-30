'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ClaseAlumno } from '@/lib/hooks/useAsistencia';

interface ConfirmacionFormProps {
  clase: ClaseAlumno;
  onConfirm: (id: string) => Promise<void>;
  onClose: () => void;
}

export function ConfirmacionForm({ clase, onConfirm, onClose }: ConfirmacionFormProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(clase.id);
      toast.success('Asistencia confirmada');
      onClose();
    } catch {
      toast.error('Error al confirmar asistencia');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-[var(--space-lg)] shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">¿Confirmar asistencia?</h2>
          <button onClick={onClose} className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-6 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-[var(--space-md)]">
          <p className="font-medium text-[var(--color-text-primary)]">
            {format(new Date(clase.horario.fecha + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })}, {clase.horario.hora_inicio}
          </p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">{clase.horario.titulo}</p>
          {clase.horario.profesor && (
            <p className="text-sm text-[var(--color-text-muted)]">
              Prof. {clase.horario.profesor.nombre} {clase.horario.profesor.apellido}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] min-h-[48px]"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-success)] px-4 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 min-h-[48px]"
          >
            <CheckCircle className="h-4 w-4" />
            {loading ? 'Confirmando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
