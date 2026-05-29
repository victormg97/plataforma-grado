-- Agrega el campo año_egreso a la tabla alumnos_extra
ALTER TABLE public.alumnos_extra
  ADD COLUMN IF NOT EXISTS año_egreso text;
