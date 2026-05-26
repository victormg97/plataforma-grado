-- Add ha_dado_examen boolean to persist the checkbox state independently of intentos_prueba.
-- intentos_prueba = number of times tried (optional). ha_dado_examen = has attempted at all.
ALTER TABLE public.alumnos_extra
  ADD COLUMN IF NOT EXISTS ha_dado_examen boolean NOT NULL DEFAULT false;
