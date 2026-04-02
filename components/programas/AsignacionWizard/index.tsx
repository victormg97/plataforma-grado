'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Check, ChevronRight, User, Calendar } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { cn } from '@/lib/utils';
import type { ClasePrograma } from '@/lib/supabase/types';

type ClaseItem = Pick<ClasePrograma, 'id' | 'nombre' | 'tipo' | 'orden'> & {
  duracion_min?: number | null;
};

type AlumnoOption = {
  id: string;
  nombre: string;
  apellido: string;
  avatar_url?: string | null;
};

type HorarioClase = {
  clase_id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
};

type HorarioAlumno = {
  alumno_id: string;
  clases: HorarioClase[];
};

interface AsignacionWizardProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (alumno_ids: string[], horarios_por_alumno: HorarioAlumno[]) => Promise<void>;
  alumnos: AlumnoOption[];
  clases: ClaseItem[];
  duracionDefault?: number;
  loading?: boolean;
}

type Step = 'alumnos' | 'horario' | 'revision';
const STEPS: Step[] = ['alumnos', 'horario', 'revision'];

export function AsignacionWizard({
  open,
  onClose,
  onConfirm,
  alumnos,
  clases,
  duracionDefault = 60,
  loading = false,
}: AsignacionWizardProps) {
  const t = useTranslations('programas');
  const [step, setStep] = useState<Step>('alumnos');
  const [selectedAlumnos, setSelectedAlumnos] = useState<string[]>([]);
  const [currentAlumnoIdx, setCurrentAlumnoIdx] = useState(0);
  const [horariosPorAlumno, setHorariosPorAlumno] = useState<HorarioAlumno[]>([]);

  const clasesOrdenadas = useMemo(
    () => [...clases].filter((c) => !!c.id).sort((a, b) => a.orden - b.orden),
    [clases]
  );

  const reset = () => {
    setStep('alumnos');
    setSelectedAlumnos([]);
    setCurrentAlumnoIdx(0);
    setHorariosPorAlumno([]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const toggleAlumno = (id: string) => {
    setSelectedAlumnos((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const initHorarios = () => {
    const initial: HorarioAlumno[] = selectedAlumnos.map((alumno_id) => ({
      alumno_id,
      clases: clasesOrdenadas.map((c) => ({
        clase_id: c.id,
        fecha: '',
        hora_inicio: '',
        hora_fin: '',
      })),
    }));
    setHorariosPorAlumno(initial);
    setCurrentAlumnoIdx(0);
    setStep('horario');
  };

  const updateHorario = (alumnoId: string, claseId: string, field: keyof HorarioClase, value: string) => {
    const autoFin =
      field === 'hora_inicio' && value
        ? (() => {
            const duracion =
              clasesOrdenadas.find((c) => c.id === claseId)?.duracion_min ?? duracionDefault;
            const [h, m] = value.split(':').map(Number);
            const total = h * 60 + m + duracion;
            const hh = Math.floor(total / 60) % 24;
            const mm = total % 60;
            return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
          })()
        : null;

    setHorariosPorAlumno((prev) =>
      prev.map((h) =>
        h.alumno_id === alumnoId
          ? {
              ...h,
              clases: h.clases.map((c) => {
                if (c.clase_id !== claseId) return c;
                const updated = { ...c, [field]: value };
                if (autoFin) updated.hora_fin = autoFin;
                return updated;
              }),
            }
          : h
      )
    );
  };

  const currentAlumnoHorario = horariosPorAlumno[currentAlumnoIdx];
  const currentAlumnoInfo = alumnos.find((a) => a.id === currentAlumnoHorario?.alumno_id);

  const isCurrentAlumnoComplete = currentAlumnoHorario?.clases.every(
    (c) => c.fecha && c.hora_inicio && c.hora_fin
  );

  const goNextAlumno = () => {
    if (currentAlumnoIdx < selectedAlumnos.length - 1) {
      setCurrentAlumnoIdx((i) => i + 1);
    } else {
      setStep('revision');
    }
  };

  const handleConfirm = async () => {
    await onConfirm(selectedAlumnos, horariosPorAlumno);
    handleClose();
  };

  const stepIndex = STEPS.indexOf(step);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      preventOutsideClose
      title={t('wizard.titulo')}
      description={t(`wizard.paso_desc.${step}`)}
      footer={
        <div className="flex w-full items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={step === 'alumnos' ? handleClose : () => {
              if (step === 'horario') {
                if (currentAlumnoIdx > 0) setCurrentAlumnoIdx((i) => i - 1);
                else setStep('alumnos');
              } else {
                setStep('horario');
              }
            }}
          >
            {step === 'alumnos' ? t('wizard.cancelar') : t('wizard.anterior')}
          </Button>

          {step === 'alumnos' && (
            <Button
              variant="primary"
              size="sm"
              disabled={selectedAlumnos.length === 0 || clasesOrdenadas.length === 0}
              onClick={initHorarios}
            >
              {t('wizard.siguiente')} <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === 'horario' && (
            <Button
              variant="primary"
              size="sm"
              disabled={!isCurrentAlumnoComplete}
              onClick={goNextAlumno}
            >
              {currentAlumnoIdx < selectedAlumnos.length - 1
                ? t('wizard.siguiente_alumno')
                : t('wizard.revisar')}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {step === 'revision' && (
            <Button variant="primary" size="sm" loading={loading} onClick={handleConfirm}>
              <Check className="mr-1 h-4 w-4" />
              {t('wizard.confirmar')}
            </Button>
          )}
        </div>
      }
    >
      {/* Step indicator */}
      <div className="mb-5 flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                i < stepIndex
                  ? 'bg-[var(--color-brand-gold)] text-white'
                  : i === stepIndex
                  ? 'bg-[var(--color-brand-gold-muted)] text-[var(--color-brand-gold)] ring-2 ring-[var(--color-brand-gold)]'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
              )}
            >
              {i < stepIndex ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={cn('text-xs', i === stepIndex ? 'font-medium text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]')}>
              {t(`wizard.paso.${s}`)}
            </span>
            {i < STEPS.length - 1 && (
              <div className={cn('h-px w-8', i < stepIndex ? 'bg-[var(--color-brand-gold)]' : 'bg-[var(--color-border)]')} />
            )}
          </div>
        ))}
      </div>

      {/* Paso 1: Seleccionar alumnos */}
      {step === 'alumnos' && (
        <div className="flex flex-col gap-2">
          {alumnos.map((alumno) => {
            const selected = selectedAlumnos.includes(alumno.id);
            return (
              <button
                key={alumno.id}
                type="button"
                onClick={() => toggleAlumno(alumno.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-[var(--radius-sm)] border px-3 py-2 text-left transition-colors',
                  selected
                    ? 'border-[var(--color-brand-gold)] bg-[var(--color-brand-gold-muted)]'
                    : 'border-[var(--color-border)] hover:border-[var(--color-brand-gold)]/50'
                )}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-secondary)]">
                  <User className="h-4 w-4 text-[var(--color-text-muted)]" />
                </div>
                <span className="flex-1 text-sm font-medium text-[var(--color-text-primary)]">
                  {alumno.nombre} {alumno.apellido}
                </span>
                {selected && <Check className="h-4 w-4 text-[var(--color-brand-gold)]" />}
              </button>
            );
          })}
          {alumnos.length === 0 && (
            <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">
              {t('wizard.sin_alumnos')}
            </p>
          )}
        </div>
      )}

      {/* Paso 2: Programar horarios */}
      {step === 'horario' && currentAlumnoHorario && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)] px-3 py-2">
            <User className="h-4 w-4 text-[var(--color-brand-gold)]" />
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {currentAlumnoInfo?.nombre} {currentAlumnoInfo?.apellido}
            </span>
            <span className="ml-auto text-xs text-[var(--color-text-muted)]">
              {currentAlumnoIdx + 1} / {selectedAlumnos.length}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {clasesOrdenadas.map((clase, idx) => {
              const h = currentAlumnoHorario.clases.find((c) => c.clase_id === clase.id);
              return (
                <div key={clase.id || idx} className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-muted)]">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">{clase.nombre}</span>
                    {clase.tipo === 'prueba' && (
                      <span className="ml-auto rounded-full bg-[var(--color-brand-gold-muted)] px-2 py-0.5 text-xs text-[var(--color-brand-gold)]">
                        {t('editor.prueba')}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-[var(--color-text-muted)]">{t('wizard.fecha')}</label>
                      <input
                        type="date"
                        value={h?.fecha ?? ''}
                        onChange={(e) => updateHorario(currentAlumnoHorario.alumno_id, clase.id, 'fecha', e.target.value)}
                        className="h-8 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-xs outline-none focus:border-[var(--color-brand-gold)]"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-[var(--color-text-muted)]">{t('wizard.hora_inicio')}</label>
                      <input
                        type="time"
                        value={h?.hora_inicio ?? ''}
                        onChange={(e) => updateHorario(currentAlumnoHorario.alumno_id, clase.id, 'hora_inicio', e.target.value)}
                        className="h-8 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-xs outline-none focus:border-[var(--color-brand-gold)]"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-[var(--color-text-muted)]">{t('wizard.hora_fin')}</label>
                      <input
                        type="time"
                        value={h?.hora_fin ?? ''}
                        onChange={(e) => updateHorario(currentAlumnoHorario.alumno_id, clase.id, 'hora_fin', e.target.value)}
                        className="h-8 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-xs outline-none focus:border-[var(--color-brand-gold)]"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Paso 3: Revisión */}
      {step === 'revision' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[var(--color-text-muted)]">{t('wizard.resumen_intro')}</p>
          {horariosPorAlumno.map((h) => {
            const alumnoInfo = alumnos.find((a) => a.id === h.alumno_id);
            return (
              <div key={h.alumno_id} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-[var(--color-brand-gold)]" />
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {alumnoInfo?.nombre} {alumnoInfo?.apellido}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {h.clases.map((c) => {
                    const clase = clasesOrdenadas.find((cl) => cl.id === c.clase_id);
                    return (
                      <div key={c.clase_id} className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span className="font-medium text-[var(--color-text-primary)]">{clase?.nombre}</span>
                        <span>{c.fecha.split('-').reverse().join('-')} {c.hora_inicio}–{c.hora_fin}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
