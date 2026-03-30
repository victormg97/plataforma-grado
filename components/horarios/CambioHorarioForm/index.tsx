'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowRight, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ClaseAlumno } from '@/lib/hooks/useAsistencia';

type HorarioDisponible = {
  id: string;
  titulo: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
};

interface CambioHorarioFormProps {
  clase: ClaseAlumno;
  alumnoId: string;
  onCambio: (asistenciaId: string, nuevoHorarioId: string, nota?: string) => Promise<void>;
  onClose: () => void;
}

export function CambioHorarioForm({ clase, alumnoId, onCambio, onClose }: CambioHorarioFormProps) {
  const [disponibles, setDisponibles] = useState<HorarioDisponible[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const profesorId = clase.horario.profesor?.id;
    if (!profesorId) return;

    fetch(`/api/horarios/disponibles?profesor_id=${profesorId}&alumno_id=${alumnoId}`)
      .then((res) => res.json())
      .then((data) => setDisponibles(Array.isArray(data) ? data : []))
      .catch(() => toast.error('Error al cargar horarios disponibles'))
      .finally(() => setLoadingSlots(false));
  }, [clase.horario.profesor?.id, alumnoId]);

  const handleSubmit = async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      await onCambio(clase.id, selectedId, nota || undefined);
      toast.success('Solicitud enviada. Tu profesor fue notificado.');
      onClose();
    } catch {
      toast.error('Error al solicitar cambio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-[var(--space-lg)] shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Solicitar cambio de horario</h2>
          <button onClick={onClose} className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] p-[var(--space-md)]">
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase mb-1">Clase actual</p>
          <p className="font-medium text-[var(--color-text-primary)]">
            {format(new Date(clase.horario.fecha + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })}, {clase.horario.hora_inicio}
          </p>
          <p className="text-sm text-[var(--color-text-muted)]">{clase.horario.titulo}</p>
        </div>

        <div className="mb-4">
          <p className="text-sm font-medium text-[var(--color-text-primary)] mb-2">Elige un horario disponible:</p>
          {loadingSlots ? (
            <div className="flex items-center justify-center py-8 text-[var(--color-text-muted)]">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Cargando horarios...
            </div>
          ) : disponibles.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">
              No hay horarios disponibles para cambio.
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {disponibles.map((h) => (
                <label
                  key={h.id}
                  className={`flex items-center gap-3 rounded-[var(--radius-md)] border p-3 cursor-pointer transition-colors ${
                    selectedId === h.id
                      ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)]'
                      : 'border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="nuevo-horario"
                    value={h.id}
                    checked={selectedId === h.id}
                    onChange={() => setSelectedId(h.id)}
                    className="accent-[var(--color-brand-gold)]"
                  />
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {format(new Date(h.fecha + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {h.hora_inicio} - {h.hora_fin} · {h.titulo}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
            Mensaje para tu profesor (opcional)
          </label>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Me gustaría cambiar porque..."
            rows={2}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-gold)]"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] px-4 py-3 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] min-h-[48px]"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedId}
            className="flex-1 flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-4 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 min-h-[48px]"
          >
            <ArrowRight className="h-4 w-4" />
            {loading ? 'Enviando...' : 'Enviar solicitud'}
          </button>
        </div>
      </div>
    </div>
  );
}
