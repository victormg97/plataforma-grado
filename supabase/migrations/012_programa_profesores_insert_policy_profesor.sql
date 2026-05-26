-- ============================================================
-- MIGRACIÓN 012: Visibilidad multi-profesor en programas_clases
-- Agrega tabla programa_profesores (junction), columna visibilidad,
-- y política INSERT para profesores.
-- ============================================================

-- 1. Columna visibilidad en programas_clases
--    'todos'      = visible para todos los profesores (programa global)
--    'especifico' = solo visible para los profes listados en programa_profesores
ALTER TABLE public.programas_clases
  ADD COLUMN IF NOT EXISTS visibilidad text NOT NULL DEFAULT 'todos'
  CHECK (visibilidad IN ('todos', 'especifico'));

-- 2. Migrar datos existentes:
--    Programas con profesor_id asignado → visibilidad 'especifico'
UPDATE public.programas_clases
  SET visibilidad = 'especifico'
  WHERE profesor_id IS NOT NULL;

-- 3. Tabla junction programa_profesores
CREATE TABLE IF NOT EXISTS public.programa_profesores (
  id          uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  programa_id uuid NOT NULL REFERENCES public.programas_clases(id) ON DELETE CASCADE,
  profesor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(programa_id, profesor_id)
);

-- 4. Migrar datos existentes:
--    Si un programa tenía profesor_id, insertar en la junction
INSERT INTO public.programa_profesores (programa_id, profesor_id)
  SELECT id, profesor_id
  FROM public.programas_clases
  WHERE profesor_id IS NOT NULL
  ON CONFLICT (programa_id, profesor_id) DO NOTHING;

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_programa_profesores_programa
  ON public.programa_profesores(programa_id);
CREATE INDEX IF NOT EXISTS idx_programa_profesores_profesor
  ON public.programa_profesores(profesor_id);

-- 6. RLS en programa_profesores
ALTER TABLE public.programa_profesores ENABLE ROW LEVEL SECURITY;

-- Admin gestiona todo
CREATE POLICY "Admin gestiona programa_profesores" ON public.programa_profesores
  FOR ALL USING (get_user_rol() = 'admin');

-- Profesor puede ver sus propias asignaciones
CREATE POLICY "Profesor ve sus programa_profesores" ON public.programa_profesores
  FOR SELECT USING (profesor_id = auth.uid());

-- 7. Actualizar la política SELECT de programas_clases:
--    Primero dropeamos la política amplia actual y la reemplazamos
DROP POLICY IF EXISTS "Autenticados ven todos los programas" ON public.programas_clases;

CREATE POLICY "Usuarios ven programas según visibilidad" ON public.programas_clases
  FOR SELECT USING (
    -- Admins ven todo
    get_user_rol() = 'admin'
    OR
    -- Programas globales (todos los profes los ven)
    visibilidad = 'todos'
    OR
    -- Programas específicos: solo los profes asignados o el creador
    (
      visibilidad = 'especifico'
      AND (
        created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.programa_profesores pp
          WHERE pp.programa_id = programas_clases.id
          AND pp.profesor_id = auth.uid()
        )
      )
    )
  );

-- 8. Política INSERT para profesores
CREATE POLICY "Profesor inserta su propia asignacion" ON public.programa_profesores
  FOR INSERT
  TO authenticated
  WITH CHECK (
    profesor_id = auth.uid()
    AND get_user_rol() = 'profesor'
  );
