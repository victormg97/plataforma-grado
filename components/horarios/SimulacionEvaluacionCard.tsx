'use client';

/**
 * Card para que un profesor de la comisión ingrese o vea su evaluación
 * de una simulación de examen de grado.
 */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/common/Avatar';

export interface EvaluacionData {
  id: string;
  profesor_id: string;
  profesor: { id: string; nombre: string; apellido: string; apellido_materno?: string | null };
  nota: number | null;
  feedback: string | null;
  estado: 'pendiente' | 'calificada';
}

export interface SimulacionEvaluacionCardProps {
  evaluacion: EvaluacionData;
  isOwner: boolean;
  onSubmit?: (data: { nota: number | null; feedback: string | null }) => void;
}

export function SimulacionEvaluacionCard({ evaluacion, isOwner, onSubmit }: SimulacionEvaluacionCardProps) {
  const t = useTranslations('horarios');
  const [editing, setEditing] = useState(false);
  const [nota, setNota] = useState<string>(evaluacion.nota != null ? evaluacion.nota.toString() : '');
  const [feedback, setFeedback] = useState<string>(evaluacion.feedback ?? '');

  const isPendiente = evaluacion.estado === 'pendiente';
  const showForm = isOwner && (isPendiente || editing);

  function handleSubmit() {
    const notaNum = nota ? parseFloat(nota) : null;
    if (notaNum !== null && (notaNum < 1 || notaNum > 7)) return;
    onSubmit?.({
      nota: notaNum,
      feedback: feedback.trim() || null,
    });
    setEditing(false);
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      {/* Header: profesor + badge */}
      <div className="mb-3 flex items-center gap-3">
        <Avatar
          nombre={evaluacion.profesor.nombre}
          apellido={evaluacion.profesor.apellido}
          size="sm"
        />
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            {[evaluacion.profesor.nombre, evaluacion.profesor.apellido, evaluacion.profesor.apellido_materno].filter(Boolean).join(' ')}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            evaluacion.estado === 'calificada'
              ? 'bg-[var(--color-success-muted,hsl(142_70%_95%))] text-[var(--color-success,hsl(142_70%_35%))]'
              : 'bg-[var(--color-warning-muted,hsl(45_90%_92%))] text-[var(--color-warning,hsl(45_90%_35%))]'
          }`}
        >
          {evaluacion.estado === 'calificada'
            ? t('evaluacion_calificada')
            : t('evaluacion_pendiente')}
        </span>
      </div>

      {/* Form mode */}
      {showForm && (
        <div className="space-y-3">
          {/* Nota input */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
              {t('evaluacion_nota_label')}
            </label>
            <input
              type="number"
              min={1}
              max={7}
              step={0.1}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]"
            />
          </div>

          {/* Feedback textarea */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
              {t('evaluacion_feedback_label')}
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              maxLength={2000}
              rows={3}
              className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-input,var(--color-bg))] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]"
            />
          </div>

          {/* Submit button */}
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-[var(--radius-md)] bg-[var(--color-brand-gold)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            {t('evaluacion_btn_calificar')}
          </button>
        </div>
      )}

      {/* Read-only mode */}
      {!showForm && (
        <div className="space-y-2">
          {evaluacion.nota != null && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-muted)]">{t('evaluacion_nota_label')}:</span>
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                {evaluacion.nota.toFixed(1)}
              </span>
            </div>
          )}
          {evaluacion.feedback && (
            <div>
              <span className="text-xs text-[var(--color-text-muted)]">{t('evaluacion_feedback_label')}:</span>
              <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">{evaluacion.feedback}</p>
            </div>
          )}
          {/* Edit button for owner with calificada estado */}
          {isOwner && evaluacion.estado === 'calificada' && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs font-medium text-[var(--color-brand-gold)] hover:underline"
            >
              {t('evaluacion_btn_editar')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
