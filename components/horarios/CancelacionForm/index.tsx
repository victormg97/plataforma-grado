'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { XCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ClaseAlumno } from '@/lib/hooks/useAsistencia';

interface CancelacionFormProps {
  clase: ClaseAlumno;
  onCancel: (id: string, nota?: string) => Promise<void>;
  onClose: () => void;
}

export function CancelacionForm({ clase, onCancel, onClose }: CancelacionFormProps) {
  const [nota, setNota] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
    setLoading(true);
    try {
      await onCancel(clase.id, nota || undefined);
      toast.success('Clase cancelada. Tu profesor fue notificado.');
      onClose();
    } catch {
      toast.error('Error al cancelar la clase');
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
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">¿No podrás asistir?</h2>
          <button onClick={onClose} className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-[var(--space-md)]">
          <p className="font-medium text-[var(--color-text-primary)]">
            {format(new Date(clase.horario.fecha + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })}, {clase.horario.hora_inicio}
          </p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">{clase.horario.titulo}</p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
            Mensaje (opcional)
          </label>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Tengo un compromiso..."
            rows={3}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-gold)]"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] min-h-[48px]"
          >
            Volver
          </button>
          <button
            onClick={handleCancel}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-error)] px-4 py-3 text-sm font-medium text-[var(--color-error)] hover:bg-red-50 dark:hover:bg-red-950/20 disabled:opacity-50 min-h-[48px]"
          >
            <XCircle className="h-4 w-4" />
            {loading ? 'Cancelando...' : 'Confirmar cancelación'}
          </button>
        </div>
      </div>
    </div>
  );
}
