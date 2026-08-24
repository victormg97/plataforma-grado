'use client';

/**
 * Punto de composición FormularioAgenda (Req 17.8).
 * Modal unificado grande que aloja el selector de tipo de evento y el formulario
 * correspondiente, con protección de datos sin guardar.
 *
 * Requisitos: 3.8, 5.9, 12.8, 12.9, 17.8
 */
import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useQueryParam } from '@/lib/hooks/useQueryParam';
import type { UserRol } from '@/lib/supabase/types';

import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { HorarioForm } from '@/components/horarios/HorarioForm';
import { FormularioEntradaPersonal } from '@/components/agenda/entradas-personales/FormularioEntradaPersonal';
import { FormularioActividad } from '@/components/agenda/actividades/FormularioActividad';

import { SelectorTipoEvento, type TipoEvento } from './SelectorTipoEvento';

export interface FormularioAgendaProps {
  open: boolean;
  onClose: () => void;
  rol: UserRol;
  profesorId: string;
  defaultDate?: string;
  defaultTime?: string;
  defaultEndTime?: string;
  onSuccess: () => void;
  cachedAlumnos?: { id: string; nombre: string; apellido: string; email: string; avatar_url: string | null }[];
  adminProfesores?: { id: string; nombre: string; apellido: string }[];
}

export function FormularioAgenda({
  open,
  onClose,
  rol,
  profesorId,
  defaultDate,
  defaultTime,
  defaultEndTime,
  onSuccess,
  cachedAlumnos,
  adminProfesores,
}: FormularioAgendaProps) {
  const t = useTranslations('agendaFormulario');
  const [agendaTipo, setAgendaTipo] = useQueryParam('agendaTipo');

  // Dirty state tracking from child forms
  const [isDirty, setIsDirty] = useState(false);
  // Confirmation dialog state
  const [confirmandoCierre, setConfirmandoCierre] = useState(false);

  // For the alumno, type is always entrada_personal (Req 5.9)
  const isAlumno = rol === 'alumno';
  const tipoActivo: TipoEvento = isAlumno
    ? 'entrada_personal'
    : (agendaTipo as TipoEvento) || 'clase';

  function handleTipoChange(tipo: TipoEvento) {
    if (!isAlumno) {
      setAgendaTipo(tipo === 'clase' ? null : tipo);
    }
  }

  // Handle dirty state from child forms
  const handleDirtyChange = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
  }, []);

  // Handle close attempt with unsaved data protection
  function handleCloseAttempt() {
    if (isDirty) {
      setConfirmandoCierre(true);
    } else {
      handleActualClose();
    }
  }

  function handleActualClose() {
    setConfirmandoCierre(false);
    setIsDirty(false);
    onClose();
  }

  function handleCancelClose() {
    setConfirmandoCierre(false);
  }

  // Build dynamic title based on type
  function getTitle(): string {
    switch (tipoActivo) {
      case 'clase':
        return t('titulo_nueva_clase');
      case 'entrada_personal':
        return t('titulo_nueva_entrada');
      case 'actividad':
        return t('titulo_nueva_actividad');
      default:
        return t('titulo_crear');
    }
  }

  if (!open) return null;

  return (
    <>
      <Modal
        open={open}
        onClose={handleCloseAttempt}
        title={getTitle()}
        size="xl"
        preventOutsideClose={isDirty}
      >
        {/* Type selector inside the modal - only for profesor/admin */}
        {!isAlumno && (
          <div className="mb-4 -mt-2">
            <SelectorTipoEvento value={tipoActivo} onChange={handleTipoChange} />
          </div>
        )}

        {/* Sub-form in inline mode */}
        {tipoActivo === 'clase' && (
          <HorarioForm
            open={true}
            onClose={handleCloseAttempt}
            profesorId={profesorId}
            defaultDate={defaultDate}
            defaultTime={defaultTime}
            defaultEndTime={defaultEndTime}
            onSuccess={() => {
              setIsDirty(false);
              onSuccess();
            }}
            cachedAlumnos={cachedAlumnos}
            adminProfesores={adminProfesores}
            renderMode="inline"
            onDirtyChange={handleDirtyChange}
          />
        )}

        {tipoActivo === 'entrada_personal' && (
          <FormularioEntradaPersonal
            open={true}
            onClose={handleCloseAttempt}
            defaultDate={defaultDate}
            defaultTime={defaultTime}
            defaultEndTime={defaultEndTime}
            rol={rol}
            onSuccess={() => {
              setIsDirty(false);
              onSuccess();
            }}
            renderMode="inline"
            onDirtyChange={handleDirtyChange}
          />
        )}

        {tipoActivo === 'actividad' && !isAlumno && (
          <FormularioActividad
            open={true}
            onClose={handleCloseAttempt}
            defaultDate={defaultDate}
            defaultTime={defaultTime}
            defaultEndTime={defaultEndTime}
            rol={rol}
            profesorId={profesorId}
            onSuccess={() => {
              setIsDirty(false);
              onSuccess();
            }}
            cachedAlumnos={cachedAlumnos}
            adminProfesores={adminProfesores}
            renderMode="inline"
            onDirtyChange={handleDirtyChange}
          />
        )}
      </Modal>

      {/* Confirmation dialog for unsaved changes */}
      {confirmandoCierre && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-xl">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
              {t('confirmar_cierre_titulo')}
            </h3>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              {t('confirmar_cierre_mensaje')}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancelClose}>
                {t('confirmar_cierre_seguir')}
              </Button>
              <Button variant="danger" size="sm" onClick={handleActualClose}>
                {t('confirmar_cierre_descartar')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
