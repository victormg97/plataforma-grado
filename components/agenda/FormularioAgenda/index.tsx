'use client';

/**
 * Punto de composición FormularioAgenda (Req 17.8).
 * Orquesta el selector de tipo de evento y monta el formulario correspondiente.
 * Sin lógica de negocio: no valida, no hace fetch, no conoce esquemas Zod.
 *
 * Requisitos: 3.8, 5.9, 12.8, 12.9, 17.8
 */
import { useQueryParam } from '@/lib/hooks/useQueryParam';
import type { UserRol } from '@/lib/supabase/types';

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
  const [agendaTipo, setAgendaTipo] = useQueryParam('agendaTipo');

  // Para el alumno el tipo es siempre entrada_personal (Req 5.9)
  const isAlumno = rol === 'alumno';
  const tipoActivo: TipoEvento = isAlumno
    ? 'entrada_personal'
    : (agendaTipo as TipoEvento) || 'clase';

  function handleTipoChange(tipo: TipoEvento) {
    if (!isAlumno) {
      setAgendaTipo(tipo === 'clase' ? null : tipo);
    }
  }

  if (!open) return null;

  return (
    <div>
      {/* Selector de tipo: solo para profesor y admin */}
      {!isAlumno && (
        <div className="mb-4">
          <SelectorTipoEvento value={tipoActivo} onChange={handleTipoChange} />
        </div>
      )}

      {/* Rama: Clase */}
      {tipoActivo === 'clase' && (
        <HorarioForm
          open={open}
          onClose={onClose}
          profesorId={profesorId}
          defaultDate={defaultDate}
          defaultTime={defaultTime}
          defaultEndTime={defaultEndTime}
          onSuccess={onSuccess}
          cachedAlumnos={cachedAlumnos}
          adminProfesores={adminProfesores}
        />
      )}

      {/* Rama: Entrada Personal */}
      {tipoActivo === 'entrada_personal' && (
        <FormularioEntradaPersonal
          open={open}
          onClose={onClose}
          defaultDate={defaultDate}
          defaultTime={defaultTime}
          defaultEndTime={defaultEndTime}
          rol={rol}
          onSuccess={onSuccess}
        />
      )}

      {/* Rama: Actividad (Req 3.8, 12.9) */}
      {tipoActivo === 'actividad' && !isAlumno && (
        <FormularioActividad
          open={open}
          onClose={onClose}
          defaultDate={defaultDate}
          defaultTime={defaultTime}
          defaultEndTime={defaultEndTime}
          rol={rol}
          profesorId={profesorId}
          onSuccess={onSuccess}
          cachedAlumnos={cachedAlumnos}
          adminProfesores={adminProfesores}
        />
      )}
    </div>
  );
}
