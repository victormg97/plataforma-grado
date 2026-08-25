'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Scale } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Avatar';
import { cn } from '@/lib/utils';
import { useUserStore } from '@/stores/useUserStore';

interface EvaluacionData {
  id: string;
  profesor_id: string;
  profesor: { id: string; nombre: string; apellido: string; apellido_materno?: string | null; avatar_url?: string | null };
  nota: number | null;
  feedback: string | null;
  estado: string;
}

interface SimulacionGradeSectionProps {
  evaluaciones: EvaluacionData[];
  horarioId: string;
}

// Same input styling as the existing GradeInlineForm
const inputCls = cn(
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)]',
  'bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)]',
  'placeholder:text-[var(--color-text-muted)]',
  'focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]',
  'transition-colors'
);

function useCalificarSimulacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, nota, feedback }: { id: string; nota: number | null; feedback?: string | null }) => {
      const res = await fetch(`/api/simulacion-evaluaciones/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nota, feedback: feedback ?? null, estado: nota != null ? 'calificada' : 'pendiente' }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['horario-detail'] });
    },
  });
}

export function SimulacionGradeSection({ evaluaciones, horarioId: _horarioId }: SimulacionGradeSectionProps) {
  const t = useTranslations('horarios');
  const { user } = useUserStore();

  if (!evaluaciones || evaluaciones.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
      <div className="flex items-center gap-2 mb-3">
        <Scale className="size-4 text-[var(--color-brand-gold)]" />
        <span className="text-sm font-semibold text-[var(--color-text-primary)]">
          {t('simulacion_calificaciones')}
        </span>
      </div>
      <div className="space-y-3">
        {evaluaciones.map((ev) => (
          <EvaluacionRow key={ev.id} evaluacion={ev} isOwn={ev.profesor_id === user?.id} />
        ))}
      </div>
    </div>
  );
}

function EvaluacionRow({ evaluacion, isOwn }: { evaluacion: EvaluacionData; isOwn: boolean }) {
  const t = useTranslations('horarios');
  const tc = useTranslations('common');
  const [nota, setNota] = useState<string>(evaluacion.nota != null ? evaluacion.nota.toFixed(1) : '');
  const { mutateAsync: calificar, isPending } = useCalificarSimulacion();

  const profName = [evaluacion.profesor?.nombre, evaluacion.profesor?.apellido, evaluacion.profesor?.apellido_materno].filter(Boolean).join(' ');

  async function handleSave() {
    const finalStr = nota.trim().replace(',', '.');
    if (finalStr === '') {
      try {
        await calificar({ id: evaluacion.id, nota: null });
        toast.success(tc('exito'));
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : tc('error'));
      }
      return;
    }
    const notaNum = parseFloat(finalStr);
    if (isNaN(notaNum) || notaNum < 1.0 || notaNum > 7.0) {
      toast.error('La nota debe estar entre 1.0 y 7.0');
      return;
    }
    setNota(notaNum.toFixed(1));
    try {
      await calificar({ id: evaluacion.id, nota: notaNum });
      toast.success(tc('exito'));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : tc('error'));
    }
  }

  // Smart input handler (same logic as GradeInlineForm)
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    let val = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
    if (val === '') { setNota(''); return; }
    if (val.startsWith('0') && !val.startsWith('0.')) val = val.substring(1);
    if (val.startsWith('.')) val = '';
    if (val.includes('.')) {
      const parts = val.split('.');
      val = `${parts[0]}.${parts[1].substring(0, 1)}`;
    }
    if (val.length === 2 && !val.includes('.')) {
      const num = parseInt(val);
      if (num >= 10 && num <= 70) val = `${val[0]}.${val[1]}`;
      else if (num > 70) val = '7.0';
      else if (num < 10) val = `${val[0]}.0`;
    }
    const f = parseFloat(val);
    if (!isNaN(f)) {
      if (f > 7.0) val = '7.0';
      if (val.length >= 3 && f < 1.0) val = '1.0';
    }
    if (val.length > 3) val = val.substring(0, 3);
    if (val.endsWith('.')) val = val.substring(0, val.length - 1);
    setNota(val);
  }

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3">
      {/* Professor avatar + name */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Avatar
          nombre={evaluacion.profesor?.nombre ?? ''}
          apellido={evaluacion.profesor?.apellido ?? ''}
          avatarUrl={evaluacion.profesor?.avatar_url ?? null}
          size="sm"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
            {profName}
            {isOwn && <span className="ml-1.5 text-[10px] text-[var(--color-brand-gold)]">({t('tu_evaluacion')})</span>}
          </p>
        </div>
      </div>

      {/* Grade display or input */}
      {isOwn ? (
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={nota}
            onChange={handleInputChange}
            placeholder="Ej: 5.5"
            className={`${inputCls} w-[70px] text-center font-bold text-base px-2`}
          />
          <Button variant="primary" loading={isPending} onClick={handleSave} disabled={isPending} className="h-9 px-3 text-xs font-semibold">
            {evaluacion.nota != null ? tc('actualizar') : tc('guardar')}
          </Button>
        </div>
      ) : (
        <div className="shrink-0">
          {evaluacion.estado === 'calificada' && evaluacion.nota != null ? (
            <div
              className="flex h-8 items-center justify-center rounded-full px-3 font-bold text-xs"
              style={{
                backgroundColor: evaluacion.nota >= 4.0
                  ? 'color-mix(in srgb, var(--color-success) 15%, transparent)'
                  : 'color-mix(in srgb, var(--color-error) 15%, transparent)',
                color: evaluacion.nota >= 4.0 ? 'var(--color-success)' : 'var(--color-error)',
                border: `1px solid color-mix(in srgb, ${evaluacion.nota >= 4.0 ? 'var(--color-success)' : 'var(--color-error)'} 30%, transparent)`,
              }}
            >
              {evaluacion.nota.toFixed(1)}
            </div>
          ) : (
            <span className="text-xs text-[var(--color-text-muted)] italic">{t('pendiente_calificacion')}</span>
          )}
        </div>
      )}
    </div>
  );
}
