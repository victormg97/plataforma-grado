-- Add nullable solicitud_id FK column to notificaciones table
ALTER TABLE public.notificaciones
  ADD COLUMN solicitud_id uuid REFERENCES public.solicitudes_cambio_horario(id) ON DELETE SET NULL;

-- Index for efficient lookups by solicitud_id
CREATE INDEX idx_notificaciones_solicitud_id ON public.notificaciones(solicitud_id);
