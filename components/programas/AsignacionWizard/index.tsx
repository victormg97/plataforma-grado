'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Check, ChevronRight } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import type { ClaseItem } from '@/lib/supabase/types';

import { StepIndicator, type Step } from './components/StepIndicator';
import { StepAlumnos } from './components/StepAlumnos';
import { StepHorario } from './components/StepHorario';
import { StepRevision } from './components/StepRevision';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS: Step[] = ['alumnos', 'horario', 'revision'];

// ─── Component ────────────────────────────────────────────────────────────────

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
              {t('wizard.siguiente')} <ChevronRight className="ml-1 size-4" />
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
              <ChevronRight className="ml-1 size-4" />
            </Button>
          )}
          {step === 'revision' && (
            <Button variant="primary" size="sm" loading={loading} onClick={handleConfirm}>
              <Check className="mr-1 size-4" />
              {t('wizard.confirmar')}
            </Button>
          )}
        </div>
      }
    >
      {/* Step indicator */}
      <StepIndicator steps={STEPS} currentStep={step} t={t} />

      {/* Paso 1: Seleccionar alumnos */}
      {step === 'alumnos' && (
        <StepAlumnos
          alumnos={alumnos}
          selectedAlumnos={selectedAlumnos}
          onToggle={toggleAlumno}
          emptyMessage={t('wizard.sin_alumnos')}
        />
      )}

      {/* Paso 2: Programar horarios */}
      {step === 'horario' && currentAlumnoHorario && (
        <StepHorario
          alumnoInfo={currentAlumnoInfo}
          horarioClases={currentAlumnoHorario}
          clasesOrdenadas={clasesOrdenadas}
          currentIndex={currentAlumnoIdx}
          totalAlumnos={selectedAlumnos.length}
          onUpdateHorario={(claseId, field, value) =>
            updateHorario(currentAlumnoHorario.alumno_id, claseId, field, value)
          }
          t={t}
        />
      )}

      {/* Paso 3: Revisión */}
      {step === 'revision' && (
        <StepRevision
          horariosPorAlumno={horariosPorAlumno}
          alumnos={alumnos}
          clasesOrdenadas={clasesOrdenadas}
          t={t}
        />
      )}
    </Modal>
  );
}
