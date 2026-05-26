-- ============================================================
-- MIGRACIÓN 007: Módulo Programas de Clases
-- Incluye: programas_clases, clases_programa, asignaciones_programa,
--          horarios_programa, pruebas, tipo_notificacion actualizado,
--          y duración default en profiles
-- ============================================================

-- 1. Ampliar enum tipo_notificacion
ALTER TYPE tipo_notificacion ADD VALUE IF NOT EXISTS 'programa_asignado';

-- 2. Columna de duración de clase por defecto en profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS duracion_clase_default_min INTEGER NOT NULL DEFAULT 60;

-- ============================================================
-- TABLAS
-- ============================================================

-- 3. programas_clases
CREATE TABLE public.programas_clases (
  id           uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  nombre       text NOT NULL,
  descripcion  text,
  profesor_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- NULL = programa global (solo admin puede crear sin profesor)
  estado       text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'eliminado')),
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 4. clases_programa
CREATE TABLE public.clases_programa (
  id           uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  programa_id  uuid REFERENCES public.programas_clases(id) ON DELETE CASCADE NOT NULL,
  nombre       text NOT NULL,
  descripcion  text,
  tipo         text NOT NULL DEFAULT 'materia' CHECK (tipo IN ('materia', 'prueba')),
  orden        integer NOT NULL DEFAULT 1,
  duracion_min integer, -- NULL = usar duracion_clase_default_min del perfil del profesor
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 5. asignaciones_programa
CREATE TABLE public.asignaciones_programa (
  id           uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  programa_id  uuid REFERENCES public.programas_clases(id) ON DELETE CASCADE NOT NULL,
  alumno_id    uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  profesor_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  estado       text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'completado', 'eliminado')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(programa_id, alumno_id)
);

-- 6. horarios_programa (trazabilidad: qué clase del programa generó qué horario)
--    Los horarios son independientes una vez creados; esto solo registra el origen.
CREATE TABLE public.horarios_programa (
  id             uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  asignacion_id  uuid REFERENCES public.asignaciones_programa(id) ON DELETE CASCADE NOT NULL,
  clase_id       uuid REFERENCES public.clases_programa(id) ON DELETE SET NULL,
  horario_id     uuid REFERENCES public.horarios(id) ON DELETE CASCADE NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 7. pruebas
CREATE TABLE public.pruebas (
  id             uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  alumno_id      uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  profesor_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  horario_id     uuid REFERENCES public.horarios(id) ON DELETE SET NULL,
  clase_id       uuid REFERENCES public.clases_programa(id) ON DELETE SET NULL,
  nombre         text NOT NULL,
  fecha          date NOT NULL,
  nota           numeric(3,1) CHECK (nota IS NULL OR (nota >= 1.0 AND nota <= 7.0)),
  observaciones  text,
  estado         text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'realizada', 'calificada')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX idx_programas_clases_profesor ON public.programas_clases(profesor_id);
CREATE INDEX idx_programas_clases_estado   ON public.programas_clases(estado);
CREATE INDEX idx_programas_clases_created_by ON public.programas_clases(created_by);

CREATE INDEX idx_clases_programa_programa  ON public.clases_programa(programa_id);
CREATE INDEX idx_clases_programa_orden     ON public.clases_programa(programa_id, orden);

CREATE INDEX idx_asignaciones_programa_pid ON public.asignaciones_programa(programa_id);
CREATE INDEX idx_asignaciones_alumno       ON public.asignaciones_programa(alumno_id);
CREATE INDEX idx_asignaciones_profesor     ON public.asignaciones_programa(profesor_id);

CREATE INDEX idx_horarios_programa_asig    ON public.horarios_programa(asignacion_id);
CREATE INDEX idx_horarios_programa_horario ON public.horarios_programa(horario_id);

CREATE INDEX idx_pruebas_alumno  ON public.pruebas(alumno_id);
CREATE INDEX idx_pruebas_profesor ON public.pruebas(profesor_id);
CREATE INDEX idx_pruebas_estado  ON public.pruebas(estado);
CREATE INDEX idx_pruebas_horario ON public.pruebas(horario_id);

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================
CREATE TRIGGER programas_clases_updated_at
  BEFORE UPDATE ON public.programas_clases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER clases_programa_updated_at
  BEFORE UPDATE ON public.clases_programa
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER asignaciones_programa_updated_at
  BEFORE UPDATE ON public.asignaciones_programa
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER pruebas_updated_at
  BEFORE UPDATE ON public.pruebas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.programas_clases        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clases_programa         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asignaciones_programa   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios_programa       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pruebas                 ENABLE ROW LEVEL SECURITY;

-- ---- programas_clases ----
-- Cualquier usuario autenticado puede VER todos los programas (para mostrar sección "otros profesores")
CREATE POLICY "Autenticados ven todos los programas" ON public.programas_clases
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Solo el creador puede insertar
CREATE POLICY "Creador inserta programa" ON public.programas_clases
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- El creador actualiza sus propios programas
CREATE POLICY "Creador actualiza sus programas" ON public.programas_clases
  FOR UPDATE USING (created_by = auth.uid());

-- El creador puede eliminar (soft-delete via UPDATE de estado, pero también DELETE físico si necesario)
CREATE POLICY "Creador elimina sus programas" ON public.programas_clases
  FOR DELETE USING (created_by = auth.uid());

-- Admin tiene acceso total (override)
CREATE POLICY "Admin gestiona todos los programas" ON public.programas_clases
  FOR ALL USING (get_user_rol() = 'admin');

-- ---- clases_programa ----
-- Todos los autenticados pueden ver las clases de cualquier programa
CREATE POLICY "Autenticados ven clases de programas" ON public.clases_programa
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Solo quien creó el programa puede gestionar sus clases
CREATE POLICY "Creador gestiona clases de su programa" ON public.clases_programa
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.programas_clases p
      WHERE p.id = clases_programa.programa_id
      AND p.created_by = auth.uid()
    )
  );

-- Admin gestiona todas las clases
CREATE POLICY "Admin gestiona todas las clases de programa" ON public.clases_programa
  FOR ALL USING (get_user_rol() = 'admin');

-- ---- asignaciones_programa ----
-- Alumno ve solo sus propias asignaciones
CREATE POLICY "Alumno ve sus asignaciones" ON public.asignaciones_programa
  FOR SELECT USING (alumno_id = auth.uid());

-- Profesor ve y gestiona asignaciones de sus programas
CREATE POLICY "Profesor gestiona sus asignaciones" ON public.asignaciones_programa
  FOR ALL USING (
    profesor_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.programas_clases p
      WHERE p.id = asignaciones_programa.programa_id
      AND p.created_by = auth.uid()
    )
  );

-- Admin gestiona todas las asignaciones
CREATE POLICY "Admin gestiona todas las asignaciones" ON public.asignaciones_programa
  FOR ALL USING (get_user_rol() = 'admin');

-- ---- horarios_programa ----
-- Profesores y admin ven toda la trazabilidad
CREATE POLICY "Profesor y admin ven trazabilidad" ON public.horarios_programa
  FOR SELECT USING (
    get_user_rol() IN ('admin', 'profesor')
  );

-- Alumno ve trazabilidad de sus asignaciones
CREATE POLICY "Alumno ve su trazabilidad" ON public.horarios_programa
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.asignaciones_programa a
      WHERE a.id = horarios_programa.asignacion_id
      AND a.alumno_id = auth.uid()
    )
  );

-- Solo inserción por profesores y admin (se crea al asignar)
CREATE POLICY "Profesor y admin insertan trazabilidad" ON public.horarios_programa
  FOR INSERT WITH CHECK (get_user_rol() IN ('admin', 'profesor'));

CREATE POLICY "Profesor y admin eliminan trazabilidad" ON public.horarios_programa
  FOR DELETE USING (get_user_rol() IN ('admin', 'profesor'));

-- ---- pruebas ----
-- Alumno ve sus propias pruebas
CREATE POLICY "Alumno ve sus pruebas" ON public.pruebas
  FOR SELECT USING (alumno_id = auth.uid());

-- Profesor ve y gestiona pruebas de sus alumnos
CREATE POLICY "Profesor gestiona pruebas de sus alumnos" ON public.pruebas
  FOR ALL USING (profesor_id = auth.uid());

-- Admin gestiona todas las pruebas
CREATE POLICY "Admin gestiona todas las pruebas" ON public.pruebas
  FOR ALL USING (get_user_rol() = 'admin');

-- ============================================================
-- REALTIME PUBLICATION
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.programas_clases;
ALTER PUBLICATION supabase_realtime ADD TABLE public.asignaciones_programa;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pruebas;
