-- Create solicitudes_cambio_horario table
CREATE TABLE public.solicitudes_cambio_horario (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  alumno_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profesor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  horario_original_id uuid NOT NULL REFERENCES public.horarios(id) ON DELETE CASCADE,
  fecha_propuesta date NOT NULL,
  hora_inicio_propuesta time NOT NULL,
  hora_fin_propuesta time NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'aceptada', 'rechazada')),
  motivo_rechazo text,
  nuevo_horario_id uuid REFERENCES public.horarios(id) ON DELETE SET NULL,
  nota_alumno text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_solicitudes_cambio_alumno_id ON public.solicitudes_cambio_horario(alumno_id);
CREATE INDEX idx_solicitudes_cambio_profesor_id ON public.solicitudes_cambio_horario(profesor_id);
CREATE INDEX idx_solicitudes_cambio_estado ON public.solicitudes_cambio_horario(estado);
CREATE INDEX idx_solicitudes_cambio_horario_original ON public.solicitudes_cambio_horario(horario_original_id);

-- Enable RLS
ALTER TABLE public.solicitudes_cambio_horario ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE TRIGGER solicitudes_cambio_horario_updated_at
  BEFORE UPDATE ON public.solicitudes_cambio_horario
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
