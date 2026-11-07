-- =============================================================================
-- 154_seguimiento_cedularios_alumno.sql
--
-- Per-student tracking of cedularios (Phase 2 of the cedularios system).
--
-- Adds five tables:
--   cedulario_asignaciones        one row per (cedulario, alumno), estado activa | desasignada
--   materia_progreso              progress of one alumno on one materia of an assignment
--   materia_progreso_repasos      any number of review records per progress row
--   materia_progreso_comentarios  any number of comments per progress row
--   materia_progreso_clases       links between a progress row and the alumno's classes
--
-- Phase 1 tables (cedularios, materias, ...) are not altered. Progress data is
-- archived, never deleted: foreign keys towards cedularios and materias are
-- ON DELETE RESTRICT.
--
-- The file is organised in sections, in this order:
--   1. Tables, constraints, indexes and updated_at triggers
--   2. SECURITY DEFINER helper functions
--   3. Guard trigger functions and triggers
--   4. Audit trigger function and triggers
--   5. Row Level Security
--   6. Write RPC functions
--   7. Read RPC functions (summary, progress, detail, activity, lists)
--   8. Redefinitions of Phase 1 functions
--   9. Realtime publication and error code notes
--
-- Idempotent: IF NOT EXISTS, DROP ... IF EXISTS before CREATE, CREATE OR REPLACE
-- and guarded DO blocks, so the whole file can be applied again. Each tenant
-- applies this file independently.
-- =============================================================================

-- =============================================================================
-- SECTION 1: TABLES, CONSTRAINTS, INDEXES AND updated_at TRIGGERS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- cedulario_asignaciones
-- At most one row per (cedulario, alumno), whatever its estado. Re-assigning
-- reactivates the same row, so the progress already recorded is kept.
-- asignado_por / desasignado_por are forced to auth.uid() by a guard trigger.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cedulario_asignaciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cedulario_id    uuid NOT NULL REFERENCES public.cedularios(id) ON DELETE RESTRICT,
  alumno_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  estado          text NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'desasignada')),
  asignado_por    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  asignado_at     timestamptz NOT NULL DEFAULT now(),
  desasignado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  desasignado_at  timestamptz,
  updated_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_cedulario_asignaciones UNIQUE (cedulario_id, alumno_id),
  CONSTRAINT ck_asignacion_desasignada_at CHECK ((estado = 'activa') = (desasignado_at IS NULL))
);

-- ---------------------------------------------------------------------------
-- materia_progreso
-- asignada = false means the materia is archived: all its data is kept but it
-- does not count for percentages. The coverage state and its date are tied by
-- ck_progreso_cobertura_fecha (both directions). A future date cannot be a
-- CHECK (it depends on now()), so a guard trigger validates it.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.materia_progreso (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asignacion_id  uuid NOT NULL REFERENCES public.cedulario_asignaciones(id) ON DELETE CASCADE,
  materia_id     uuid NOT NULL REFERENCES public.materias(id) ON DELETE RESTRICT,
  asignada       boolean NOT NULL DEFAULT true,
  estado         text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'cubierta')),
  fecha_cubierta date,
  cubierta_por   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  cubierta_at    timestamptz,
  notas          text CHECK (notas IS NULL OR char_length(notas) <= 2000),
  updated_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_materia_progreso UNIQUE (asignacion_id, materia_id),
  CONSTRAINT ck_progreso_cobertura_fecha CHECK ((estado = 'cubierta') = (fecha_cubierta IS NOT NULL))
);

-- ---------------------------------------------------------------------------
-- materia_progreso_repasos
-- asignacion_id is derived from progreso_id by a guard trigger. It has no
-- foreign key on purpose (avoids a second cascade path); it only serves the
-- Realtime filter and the audit metadata.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.materia_progreso_repasos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  progreso_id   uuid NOT NULL REFERENCES public.materia_progreso(id) ON DELETE CASCADE,
  asignacion_id uuid NOT NULL,
  fecha         date NOT NULL,
  nota          text CHECK (nota IS NULL OR char_length(nota) <= 500),
  created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- materia_progreso_comentarios
-- created_by is the author (forced to auth.uid() by a guard trigger). The
-- trigger trims texto before the CHECK runs, so the 1000 limit applies to the
-- trimmed text. edited_at is the last time the text was edited.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.materia_progreso_comentarios (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  progreso_id   uuid NOT NULL REFERENCES public.materia_progreso(id) ON DELETE CASCADE,
  asignacion_id uuid NOT NULL,
  texto         text NOT NULL CHECK (char_length(btrim(texto)) BETWEEN 1 AND 1000),
  created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  edited_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- materia_progreso_clases
-- Links a progress row to a class (horarios) of the same alumno. No updated_at:
-- links are only created and deleted. Deleting a horario cascades to its links.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.materia_progreso_clases (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  progreso_id   uuid NOT NULL REFERENCES public.materia_progreso(id) ON DELETE CASCADE,
  asignacion_id uuid NOT NULL,
  horario_id    uuid NOT NULL REFERENCES public.horarios(id) ON DELETE CASCADE,
  created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_materia_progreso_clases UNIQUE (progreso_id, horario_id)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- The unique constraints above already create their own indexes
-- (uq_cedulario_asignaciones, uq_materia_progreso, uq_materia_progreso_clases).
-- Every foreign key column gets an index.
-- NOTE: the two indexes on horarios and the one on historial_cambios are
-- created inside the migration transaction. On a tenant with a large horarios
-- table, create them beforehand with CREATE INDEX CONCURRENTLY (outside a
-- transaction); the IF NOT EXISTS clauses below then become no-ops.
-- ---------------------------------------------------------------------------

-- cedulario_asignaciones
CREATE INDEX IF NOT EXISTS idx_asignaciones_alumno_estado
  ON public.cedulario_asignaciones (alumno_id, estado);
CREATE INDEX IF NOT EXISTS idx_asignaciones_cedulario_estado
  ON public.cedulario_asignaciones (cedulario_id, estado);
CREATE INDEX IF NOT EXISTS idx_asignaciones_asignado_por
  ON public.cedulario_asignaciones (asignado_por);
CREATE INDEX IF NOT EXISTS idx_asignaciones_desasignado_por
  ON public.cedulario_asignaciones (desasignado_por);
CREATE INDEX IF NOT EXISTS idx_asignaciones_updated_by
  ON public.cedulario_asignaciones (updated_by);

-- materia_progreso
CREATE INDEX IF NOT EXISTS idx_progreso_materia
  ON public.materia_progreso (materia_id);
CREATE INDEX IF NOT EXISTS idx_progreso_cubierta_por
  ON public.materia_progreso (cubierta_por);
CREATE INDEX IF NOT EXISTS idx_progreso_updated_by
  ON public.materia_progreso (updated_by);

-- materia_progreso_repasos
CREATE INDEX IF NOT EXISTS idx_repasos_progreso
  ON public.materia_progreso_repasos (progreso_id, fecha DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_repasos_asignacion
  ON public.materia_progreso_repasos (asignacion_id);
CREATE INDEX IF NOT EXISTS idx_repasos_created_by
  ON public.materia_progreso_repasos (created_by);
CREATE INDEX IF NOT EXISTS idx_repasos_updated_by
  ON public.materia_progreso_repasos (updated_by);

-- materia_progreso_comentarios
CREATE INDEX IF NOT EXISTS idx_comentarios_progreso
  ON public.materia_progreso_comentarios (progreso_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comentarios_asignacion
  ON public.materia_progreso_comentarios (asignacion_id);
CREATE INDEX IF NOT EXISTS idx_comentarios_created_by
  ON public.materia_progreso_comentarios (created_by);
CREATE INDEX IF NOT EXISTS idx_comentarios_updated_by
  ON public.materia_progreso_comentarios (updated_by);

-- materia_progreso_clases
CREATE INDEX IF NOT EXISTS idx_clases_horario
  ON public.materia_progreso_clases (horario_id);
CREATE INDEX IF NOT EXISTS idx_clases_asignacion
  ON public.materia_progreso_clases (asignacion_id);
CREATE INDEX IF NOT EXISTS idx_clases_created_by
  ON public.materia_progreso_clases (created_by);

-- horarios (existing table): additive indexes for es_alumno_propio() and for
-- listing the linkable classes of an alumno. alumnos_extra already has an index
-- on (profesor_id, alumno_id).
CREATE INDEX IF NOT EXISTS idx_horarios_profesor_alumno
  ON public.horarios (profesor_id, alumno_id);
CREATE INDEX IF NOT EXISTS idx_horarios_alumno_fecha
  ON public.horarios (alumno_id, fecha DESC);

-- historial_cambios (existing table): partial index for the activity tab of an
-- assignment and for "last activity". Only rows written by the tracking audit
-- trigger carry metadata->>'asignacion_id'.
CREATE INDEX IF NOT EXISTS idx_historial_asignacion
  ON public.historial_cambios (((metadata->>'asignacion_id')::uuid), created_at DESC, id DESC)
  WHERE metadata->>'asignacion_id' IS NOT NULL;

-- ---------------------------------------------------------------------------
-- updated_at triggers (update_updated_at() comes from migration 001).
-- Not on materia_progreso_clases: it has no updated_at.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS cedulario_asignaciones_updated_at ON public.cedulario_asignaciones;
CREATE TRIGGER cedulario_asignaciones_updated_at
  BEFORE UPDATE ON public.cedulario_asignaciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS materia_progreso_updated_at ON public.materia_progreso;
CREATE TRIGGER materia_progreso_updated_at
  BEFORE UPDATE ON public.materia_progreso
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS materia_progreso_repasos_updated_at ON public.materia_progreso_repasos;
CREATE TRIGGER materia_progreso_repasos_updated_at
  BEFORE UPDATE ON public.materia_progreso_repasos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS materia_progreso_comentarios_updated_at ON public.materia_progreso_comentarios;
CREATE TRIGGER materia_progreso_comentarios_updated_at
  BEFORE UPDATE ON public.materia_progreso_comentarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================================================
-- END OF SECTION 1: TABLES, CONSTRAINTS, INDEXES AND updated_at TRIGGERS
-- =============================================================================

-- =============================================================================
-- SECTION 2: HELPER FUNCTIONS
--
-- SECURITY DEFINER helpers are used by policies and triggers without entering
-- RLS again (same cure against recursion as migration 016 and Phase 1).
-- All of them are STABLE with a fixed search_path, except where noted.
-- Execution is revoked from PUBLIC and anon and granted to authenticated.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- seguimiento_hoy: today's date in the platform timezone (America/Santiago).
-- Mirror of PLATFORM_TIMEZONE in lib/cedularios/seguimiento/constants.ts: both
-- must change together. Not SECURITY DEFINER: it reads no table.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seguimiento_hoy()
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (now() AT TIME ZONE 'America/Santiago')::date;
$$;

REVOKE ALL ON FUNCTION public.seguimiento_hoy() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seguimiento_hoy() TO authenticated;

-- ---------------------------------------------------------------------------
-- es_alumno_propio: true when the alumno is an "own alumno" of the current
-- profesor, that is, an alumnos_extra row links them, or at least one horarios
-- row has that profesor and that alumno (whatever its activo value).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.es_alumno_propio(p_alumno_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1
      FROM public.alumnos_extra ae
      WHERE ae.alumno_id = p_alumno_id
        AND ae.profesor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.horarios h
      WHERE h.alumno_id = p_alumno_id
        AND h.profesor_id = auth.uid()
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.es_alumno_propio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.es_alumno_propio(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- puede_gestionar_seguimiento_alumno: the "manager of the alumno". True for an
-- admin, or for a profesor whose own alumno it is, and only when the target
-- profile has rol 'alumno'.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.puede_gestionar_seguimiento_alumno(p_alumno_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      public.get_user_rol() = 'admin'
      OR (public.get_user_rol() = 'profesor' AND public.es_alumno_propio(p_alumno_id))
    )
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_alumno_id AND p.rol = 'alumno'),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.puede_gestionar_seguimiento_alumno(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.puede_gestionar_seguimiento_alumno(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- seguimiento_alumno_valido: the profile has rol 'alumno' and is active.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seguimiento_alumno_valido(p_alumno_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = p_alumno_id
        AND p.rol = 'alumno'
        AND p.activo = true
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.seguimiento_alumno_valido(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seguimiento_alumno_valido(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- seg_asignacion_alumno: the alumno_id of an assignment, or NULL when the
-- assignment does not exist.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seg_asignacion_alumno(p_asignacion_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.alumno_id
  FROM public.cedulario_asignaciones a
  WHERE a.id = p_asignacion_id;
$$;

REVOKE ALL ON FUNCTION public.seg_asignacion_alumno(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seg_asignacion_alumno(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- seg_puede_gestionar_asignacion: the current user manages the alumno that owns
-- the assignment. False when the assignment does not exist.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seg_puede_gestionar_asignacion(p_asignacion_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    public.puede_gestionar_seguimiento_alumno(public.seg_asignacion_alumno(p_asignacion_id)),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.seg_puede_gestionar_asignacion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seg_puede_gestionar_asignacion(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- seg_alumno_ve_progreso: the progress row is assigned (asignada = true) and
-- its assignment belongs to the current user and is activa. Used by the alumno
-- SELECT policies of the child tables.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seg_alumno_ve_progreso(p_progreso_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1
      FROM public.materia_progreso mp
      JOIN public.cedulario_asignaciones a ON a.id = mp.asignacion_id
      WHERE mp.id = p_progreso_id
        AND mp.asignada = true
        AND a.alumno_id = auth.uid()
        AND a.estado = 'activa'
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.seg_alumno_ve_progreso(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seg_alumno_ve_progreso(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- seguimiento_tablas: names of the five tracking tables. get_historial_cedulario
-- uses it to hide their audit rows from the Phase 1 history.
-- IMMUTABLE and not SECURITY DEFINER: it reads no table.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seguimiento_tablas()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY[
    'cedulario_asignaciones',
    'materia_progreso',
    'materia_progreso_repasos',
    'materia_progreso_comentarios',
    'materia_progreso_clases'
  ]::text[];
$$;

REVOKE ALL ON FUNCTION public.seguimiento_tablas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seguimiento_tablas() TO authenticated;

-- ---------------------------------------------------------------------------
-- cedulario_tiene_asignaciones: redefines the Phase 1 stub (always false).
-- True when the cedulario has at least one assignment in estado 'activa'.
-- Called by cedularios_guard (Phase 1), which raises CD008 when it is true.
-- Same signature, security and permissions as the Phase 1 version.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cedulario_tiene_asignaciones(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cedulario_asignaciones a
    WHERE a.cedulario_id = p_id
      AND a.estado = 'activa'
  );
$$;

REVOKE ALL ON FUNCTION public.cedulario_tiene_asignaciones(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cedulario_tiene_asignaciones(uuid) TO authenticated;

-- =============================================================================
-- END OF SECTION 2: HELPER FUNCTIONS
-- =============================================================================

-- =============================================================================
-- SECTION 3: GUARD TRIGGER FUNCTIONS AND TRIGGERS
--
-- All guards are SECURITY DEFINER with a fixed search_path and no EXECUTE for
-- clients (a trigger function does not need it). Each one checks permission
-- first (42501), so an observer always gets a permission error and never a
-- business rule error.
--
-- Calls without a JWT user (auth.uid() IS NULL: service role, SQL editor, or an
-- FK action such as the ON DELETE SET NULL of a *_por column when a profile is
-- deleted) skip the permission and state checks (42501, CD011, CD012, CD015).
-- The integrity checks (immutable keys, materia and class ownership) always run.
-- ON DELETE SET NULL cascades (pg_trigger_depth() > 1) that only null an author
-- column are let through untouched, same as cedularios_guard in Phase 1.
--
-- Error codes used by this section:
--   42501  permission denied
--   23514  check violation (immutable key changed)
--   CD011  alumno is not a valid, active alumno
--   CD012  assignment is not activa
--   CD013  class does not belong to the alumno of the assignment
--   CD014  materia does not belong to the cedulario, is inactive, or the
--          progress row is archived
--   CD015  date is later than today in the platform timezone
--   CD016  cedulario does not exist or is inactive
-- =============================================================================

-- ---------------------------------------------------------------------------
-- seg_asignaciones_guard: BEFORE INSERT OR UPDATE ON cedulario_asignaciones
--   - permission: puede_gestionar_seguimiento_alumno (42501)
--   - cedulario_id and alumno_id are immutable (23514)
--   - on INSERT and on desasignada -> activa: the alumno must be valid and
--     active (CD011, also for an admin: decision D-S20) and the cedulario must
--     exist and be active (CD016)
--   - asignado_por / desasignado_por and their dates are forced here, any value
--     sent by the client is ignored
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seg_asignaciones_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_activando boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- ON DELETE SET NULL of an author column (profile deleted): let it through.
    IF pg_trigger_depth() > 1
       AND ((OLD.asignado_por IS NOT NULL AND NEW.asignado_por IS NULL)
            OR (OLD.desasignado_por IS NOT NULL AND NEW.desasignado_por IS NULL)
            OR (OLD.updated_by IS NOT NULL AND NEW.updated_by IS NULL)) THEN
      RETURN NEW;
    END IF;

    IF v_uid IS NOT NULL
       AND NOT public.puede_gestionar_seguimiento_alumno(OLD.alumno_id) THEN
      RAISE EXCEPTION 'seguimiento.sin_permisos' USING ERRCODE = '42501';
    END IF;

    IF NEW.cedulario_id IS DISTINCT FROM OLD.cedulario_id
       OR NEW.alumno_id IS DISTINCT FROM OLD.alumno_id THEN
      RAISE EXCEPTION 'seguimiento.asignacion_clave_inmutable' USING ERRCODE = '23514';
    END IF;

    v_activando := (OLD.estado = 'desasignada' AND NEW.estado = 'activa');
  ELSE
    IF v_uid IS NOT NULL
       AND NOT public.puede_gestionar_seguimiento_alumno(NEW.alumno_id) THEN
      RAISE EXCEPTION 'seguimiento.sin_permisos' USING ERRCODE = '42501';
    END IF;

    v_activando := true;
  END IF;

  IF v_activando THEN
    IF v_uid IS NOT NULL AND NOT public.seguimiento_alumno_valido(NEW.alumno_id) THEN
      RAISE EXCEPTION 'seguimiento.alumno_no_valido' USING ERRCODE = 'CD011';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.cedularios c
      WHERE c.id = NEW.cedulario_id
        AND c.activo = true
    ) THEN
      RAISE EXCEPTION 'seguimiento.cedulario_no_disponible' USING ERRCODE = 'CD016';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.asignado_at := now();
    IF v_uid IS NOT NULL THEN
      NEW.asignado_por := v_uid;
    END IF;
    IF NEW.estado = 'activa' THEN
      NEW.desasignado_por := NULL;
      NEW.desasignado_at := NULL;
    ELSE
      NEW.desasignado_por := v_uid;
      NEW.desasignado_at := now();
    END IF;
  ELSIF OLD.estado = 'desasignada' AND NEW.estado = 'activa' THEN
    -- Re-assignment: the same row is reactivated with the new operation data.
    NEW.asignado_por := v_uid;
    NEW.asignado_at := now();
    NEW.desasignado_por := NULL;
    NEW.desasignado_at := NULL;
  ELSIF OLD.estado = 'activa' AND NEW.estado = 'desasignada' THEN
    NEW.desasignado_por := v_uid;
    NEW.desasignado_at := now();
    NEW.asignado_por := OLD.asignado_por;
    NEW.asignado_at := OLD.asignado_at;
  ELSIF v_uid IS NOT NULL THEN
    -- No state change: the stamps cannot be edited by a client.
    NEW.asignado_por := OLD.asignado_por;
    NEW.asignado_at := OLD.asignado_at;
    NEW.desasignado_por := OLD.desasignado_por;
    NEW.desasignado_at := OLD.desasignado_at;
  END IF;

  NEW.updated_by := v_uid;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.seg_asignaciones_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS seg_asignaciones_guard ON public.cedulario_asignaciones;
CREATE TRIGGER seg_asignaciones_guard
  BEFORE INSERT OR UPDATE ON public.cedulario_asignaciones
  FOR EACH ROW EXECUTE FUNCTION public.seg_asignaciones_guard();

-- ---------------------------------------------------------------------------
-- seg_progreso_guard: BEFORE INSERT OR UPDATE ON materia_progreso
--   - permission (42501), asignacion_id and materia_id immutable (23514)
--   - the assignment must be activa (CD012)
--   - the alumno must be valid unless the user is an admin (CD011)
--   - on INSERT and when asignada goes to true: the materia belongs to the
--     cedulario of the assignment and is active (CD014)
--   - a change of estado, fecha_cubierta or notas needs the row assigned before
--     and after, and the materia active (CD014)
--   - a new fecha_cubierta later than today is rejected (CD015)
--   - coverage stamps (fecha_cubierta, cubierta_por, cubierta_at) are derived
--     here; they run before ck_progreso_cobertura_fecha is evaluated
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seg_progreso_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid            uuid := auth.uid();
  v_asignacion_id  uuid;
  v_asig_estado    text;
  v_asig_alumno    uuid;
  v_asig_cedulario uuid;
  v_mat_cedulario  uuid;
  v_mat_activo     boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- ON DELETE SET NULL of an author column (profile deleted): let it through.
    IF pg_trigger_depth() > 1
       AND ((OLD.cubierta_por IS NOT NULL AND NEW.cubierta_por IS NULL)
            OR (OLD.updated_by IS NOT NULL AND NEW.updated_by IS NULL)) THEN
      RETURN NEW;
    END IF;
    v_asignacion_id := OLD.asignacion_id;
  ELSE
    v_asignacion_id := NEW.asignacion_id;
  END IF;

  SELECT a.estado, a.alumno_id, a.cedulario_id
    INTO v_asig_estado, v_asig_alumno, v_asig_cedulario
  FROM public.cedulario_asignaciones a
  WHERE a.id = v_asignacion_id;

  IF NOT FOUND THEN
    IF v_uid IS NOT NULL THEN
      RAISE EXCEPTION 'seguimiento.sin_permisos' USING ERRCODE = '42501';
    END IF;
    -- No session: the foreign key rejects the row right after this trigger.
    RETURN NEW;
  END IF;

  IF v_uid IS NOT NULL
     AND NOT public.puede_gestionar_seguimiento_alumno(v_asig_alumno) THEN
    RAISE EXCEPTION 'seguimiento.sin_permisos' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE'
     AND (NEW.asignacion_id IS DISTINCT FROM OLD.asignacion_id
          OR NEW.materia_id IS DISTINCT FROM OLD.materia_id) THEN
    RAISE EXCEPTION 'seguimiento.progreso_clave_inmutable' USING ERRCODE = '23514';
  END IF;

  IF v_uid IS NOT NULL AND v_asig_estado <> 'activa' THEN
    RAISE EXCEPTION 'seguimiento.asignacion_inactiva' USING ERRCODE = 'CD012';
  END IF;

  IF v_uid IS NOT NULL
     AND public.get_user_rol() IS DISTINCT FROM 'admin'
     AND NOT public.seguimiento_alumno_valido(v_asig_alumno) THEN
    RAISE EXCEPTION 'seguimiento.alumno_no_valido' USING ERRCODE = 'CD011';
  END IF;

  SELECT m.cedulario_id, m.activo
    INTO v_mat_cedulario, v_mat_activo
  FROM public.materias m
  WHERE m.id = NEW.materia_id;

  IF NOT FOUND THEN
    -- The foreign key rejects the row right after this trigger.
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' OR (NEW.asignada AND NOT OLD.asignada) THEN
    IF v_mat_cedulario IS DISTINCT FROM v_asig_cedulario OR NOT v_mat_activo THEN
      RAISE EXCEPTION 'seguimiento.materia_invalida' USING ERRCODE = 'CD014';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
     AND (NEW.estado IS DISTINCT FROM OLD.estado
          OR NEW.fecha_cubierta IS DISTINCT FROM OLD.fecha_cubierta
          OR NEW.notas IS DISTINCT FROM OLD.notas) THEN
    IF NOT (OLD.asignada AND NEW.asignada AND v_mat_activo) THEN
      RAISE EXCEPTION 'seguimiento.materia_invalida' USING ERRCODE = 'CD014';
    END IF;
  END IF;

  IF v_uid IS NOT NULL
     AND NEW.fecha_cubierta IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.fecha_cubierta IS DISTINCT FROM OLD.fecha_cubierta)
     AND NEW.fecha_cubierta > public.seguimiento_hoy() THEN
    RAISE EXCEPTION 'seguimiento.fecha_futura' USING ERRCODE = 'CD015';
  END IF;

  IF NEW.estado = 'cubierta' THEN
    NEW.fecha_cubierta := COALESCE(NEW.fecha_cubierta, public.seguimiento_hoy());
    IF TG_OP = 'INSERT' OR OLD.estado <> 'cubierta' THEN
      NEW.cubierta_por := v_uid;
      NEW.cubierta_at := now();
    ELSIF v_uid IS NOT NULL THEN
      -- Only the date changed: who covered it, and when, stays as it was.
      NEW.cubierta_por := OLD.cubierta_por;
      NEW.cubierta_at := OLD.cubierta_at;
    END IF;
  ELSE
    NEW.fecha_cubierta := NULL;
    NEW.cubierta_por := NULL;
    NEW.cubierta_at := NULL;
  END IF;

  NEW.updated_by := v_uid;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.seg_progreso_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS seg_progreso_guard ON public.materia_progreso;
CREATE TRIGGER seg_progreso_guard
  BEFORE INSERT OR UPDATE ON public.materia_progreso
  FOR EACH ROW EXECUTE FUNCTION public.seg_progreso_guard();

-- ---------------------------------------------------------------------------
-- seg_repasos_guard: BEFORE INSERT OR UPDATE ON materia_progreso_repasos
--   - asignacion_id is always derived from progreso_id (client value ignored)
--   - progreso_id immutable (23514), permission (42501), assignment activa
--     (CD012)
--   - on INSERT the progress row must be assigned and its materia active (CD014)
--   - a date later than today is rejected (CD015)
--   - created_by is forced on INSERT, updated_by on every write; on UPDATE
--     created_by and created_at are kept
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seg_repasos_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_progreso_id   uuid;
  v_asignacion_id uuid;
  v_asig_estado   text;
  v_asig_alumno   uuid;
  v_asignada      boolean;
  v_mat_activo    boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- ON DELETE SET NULL of an author column (profile deleted): let it through.
    IF pg_trigger_depth() > 1
       AND ((OLD.created_by IS NOT NULL AND NEW.created_by IS NULL)
            OR (OLD.updated_by IS NOT NULL AND NEW.updated_by IS NULL)) THEN
      RETURN NEW;
    END IF;
    v_progreso_id := OLD.progreso_id;
  ELSE
    v_progreso_id := NEW.progreso_id;
  END IF;

  SELECT a.id, a.estado, a.alumno_id, mp.asignada, m.activo
    INTO v_asignacion_id, v_asig_estado, v_asig_alumno, v_asignada, v_mat_activo
  FROM public.materia_progreso mp
  JOIN public.cedulario_asignaciones a ON a.id = mp.asignacion_id
  JOIN public.materias m ON m.id = mp.materia_id
  WHERE mp.id = v_progreso_id;

  IF NOT FOUND THEN
    IF v_uid IS NOT NULL THEN
      RAISE EXCEPTION 'seguimiento.sin_permisos' USING ERRCODE = '42501';
    END IF;
    -- No session: the foreign key rejects the row right after this trigger.
    RETURN NEW;
  END IF;

  IF v_uid IS NOT NULL
     AND NOT public.puede_gestionar_seguimiento_alumno(v_asig_alumno) THEN
    RAISE EXCEPTION 'seguimiento.sin_permisos' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.progreso_id IS DISTINCT FROM OLD.progreso_id THEN
    RAISE EXCEPTION 'seguimiento.hijo_clave_inmutable' USING ERRCODE = '23514';
  END IF;

  NEW.asignacion_id := v_asignacion_id;

  IF v_uid IS NOT NULL AND v_asig_estado <> 'activa' THEN
    RAISE EXCEPTION 'seguimiento.asignacion_inactiva' USING ERRCODE = 'CD012';
  END IF;

  IF TG_OP = 'INSERT' AND NOT (v_asignada AND v_mat_activo) THEN
    RAISE EXCEPTION 'seguimiento.materia_invalida' USING ERRCODE = 'CD014';
  END IF;

  IF v_uid IS NOT NULL AND NEW.fecha > public.seguimiento_hoy() THEN
    RAISE EXCEPTION 'seguimiento.fecha_futura' USING ERRCODE = 'CD015';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_uid IS NOT NULL THEN
      NEW.created_by := v_uid;
    END IF;
  ELSIF v_uid IS NOT NULL THEN
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;

  NEW.updated_by := v_uid;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.seg_repasos_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS seg_repasos_guard ON public.materia_progreso_repasos;
CREATE TRIGGER seg_repasos_guard
  BEFORE INSERT OR UPDATE ON public.materia_progreso_repasos
  FOR EACH ROW EXECUTE FUNCTION public.seg_repasos_guard();

-- ---------------------------------------------------------------------------
-- seg_comentarios_guard: BEFORE INSERT OR UPDATE ON materia_progreso_comentarios
--   - same derivation, permission, CD012 and CD014 rules as repasos
--   - texto is trimmed before the length CHECK runs
--   - created_by (the author) is forced on INSERT
--   - on UPDATE only texto can change: the user must be the author or an admin
--     (42501) and edited_at is set when the text changes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seg_comentarios_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_progreso_id   uuid;
  v_asignacion_id uuid;
  v_asig_estado   text;
  v_asig_alumno   uuid;
  v_asignada      boolean;
  v_mat_activo    boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- ON DELETE SET NULL of an author column (profile deleted): let it through.
    IF pg_trigger_depth() > 1
       AND ((OLD.created_by IS NOT NULL AND NEW.created_by IS NULL)
            OR (OLD.updated_by IS NOT NULL AND NEW.updated_by IS NULL)) THEN
      RETURN NEW;
    END IF;
    v_progreso_id := OLD.progreso_id;
  ELSE
    v_progreso_id := NEW.progreso_id;
  END IF;

  SELECT a.id, a.estado, a.alumno_id, mp.asignada, m.activo
    INTO v_asignacion_id, v_asig_estado, v_asig_alumno, v_asignada, v_mat_activo
  FROM public.materia_progreso mp
  JOIN public.cedulario_asignaciones a ON a.id = mp.asignacion_id
  JOIN public.materias m ON m.id = mp.materia_id
  WHERE mp.id = v_progreso_id;

  IF NOT FOUND THEN
    IF v_uid IS NOT NULL THEN
      RAISE EXCEPTION 'seguimiento.sin_permisos' USING ERRCODE = '42501';
    END IF;
    -- No session: the foreign key rejects the row right after this trigger.
    RETURN NEW;
  END IF;

  IF v_uid IS NOT NULL
     AND NOT public.puede_gestionar_seguimiento_alumno(v_asig_alumno) THEN
    RAISE EXCEPTION 'seguimiento.sin_permisos' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' AND v_uid IS NOT NULL
     AND OLD.created_by IS DISTINCT FROM v_uid
     AND public.get_user_rol() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'seguimiento.sin_permisos' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.progreso_id IS DISTINCT FROM OLD.progreso_id THEN
    RAISE EXCEPTION 'seguimiento.hijo_clave_inmutable' USING ERRCODE = '23514';
  END IF;

  NEW.asignacion_id := v_asignacion_id;

  IF v_uid IS NOT NULL AND v_asig_estado <> 'activa' THEN
    RAISE EXCEPTION 'seguimiento.asignacion_inactiva' USING ERRCODE = 'CD012';
  END IF;

  IF TG_OP = 'INSERT' AND NOT (v_asignada AND v_mat_activo) THEN
    RAISE EXCEPTION 'seguimiento.materia_invalida' USING ERRCODE = 'CD014';
  END IF;

  NEW.texto := btrim(NEW.texto);

  IF TG_OP = 'INSERT' THEN
    IF v_uid IS NOT NULL THEN
      NEW.created_by := v_uid;
    END IF;
  ELSE
    IF v_uid IS NOT NULL THEN
      NEW.created_by := OLD.created_by;
      NEW.created_at := OLD.created_at;
    END IF;
    IF NEW.texto IS DISTINCT FROM OLD.texto THEN
      NEW.edited_at := now();
    ELSE
      NEW.edited_at := OLD.edited_at;
    END IF;
  END IF;

  NEW.updated_by := v_uid;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.seg_comentarios_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS seg_comentarios_guard ON public.materia_progreso_comentarios;
CREATE TRIGGER seg_comentarios_guard
  BEFORE INSERT OR UPDATE ON public.materia_progreso_comentarios
  FOR EACH ROW EXECUTE FUNCTION public.seg_comentarios_guard();

-- ---------------------------------------------------------------------------
-- seg_clases_guard: BEFORE INSERT ON materia_progreso_clases
--   - asignacion_id is derived from progreso_id
--   - permission (42501), assignment activa (CD012)
--   - the progress row must be assigned and its materia active (CD014)
--   - the class (horarios) must belong to the alumno of the assignment (CD013)
--   - created_by is forced to auth.uid()
-- Links are never updated, so there is no UPDATE trigger.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seg_clases_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_asignacion_id uuid;
  v_asig_estado   text;
  v_asig_alumno   uuid;
  v_asignada      boolean;
  v_mat_activo    boolean;
  v_horario_alumno uuid;
BEGIN
  SELECT a.id, a.estado, a.alumno_id, mp.asignada, m.activo
    INTO v_asignacion_id, v_asig_estado, v_asig_alumno, v_asignada, v_mat_activo
  FROM public.materia_progreso mp
  JOIN public.cedulario_asignaciones a ON a.id = mp.asignacion_id
  JOIN public.materias m ON m.id = mp.materia_id
  WHERE mp.id = NEW.progreso_id;

  IF NOT FOUND THEN
    IF v_uid IS NOT NULL THEN
      RAISE EXCEPTION 'seguimiento.sin_permisos' USING ERRCODE = '42501';
    END IF;
    -- No session: the foreign key rejects the row right after this trigger.
    RETURN NEW;
  END IF;

  IF v_uid IS NOT NULL
     AND NOT public.puede_gestionar_seguimiento_alumno(v_asig_alumno) THEN
    RAISE EXCEPTION 'seguimiento.sin_permisos' USING ERRCODE = '42501';
  END IF;

  NEW.asignacion_id := v_asignacion_id;

  IF v_uid IS NOT NULL AND v_asig_estado <> 'activa' THEN
    RAISE EXCEPTION 'seguimiento.asignacion_inactiva' USING ERRCODE = 'CD012';
  END IF;

  IF NOT (v_asignada AND v_mat_activo) THEN
    RAISE EXCEPTION 'seguimiento.materia_invalida' USING ERRCODE = 'CD014';
  END IF;

  SELECT h.alumno_id
    INTO v_horario_alumno
  FROM public.horarios h
  WHERE h.id = NEW.horario_id;

  -- A missing horario is rejected by the foreign key right after this trigger.
  IF FOUND AND v_horario_alumno IS DISTINCT FROM v_asig_alumno THEN
    RAISE EXCEPTION 'seguimiento.clase_otro_alumno' USING ERRCODE = 'CD013';
  END IF;

  IF v_uid IS NOT NULL THEN
    NEW.created_by := v_uid;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.seg_clases_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS seg_clases_guard ON public.materia_progreso_clases;
CREATE TRIGGER seg_clases_guard
  BEFORE INSERT ON public.materia_progreso_clases
  FOR EACH ROW EXECUTE FUNCTION public.seg_clases_guard();

-- ---------------------------------------------------------------------------
-- seg_hijo_delete_guard: BEFORE DELETE on the three child tables (repasos,
-- comentarios, clases). A direct delete (pg_trigger_depth() = 1) needs the
-- assignment to be activa (CD012). Cascades (ON DELETE CASCADE from horarios,
-- from the progress row or from the assignment) run at a greater depth and are
-- never blocked, so deleting a horario still removes its links (Req 9.9).
-- Permission to delete is decided by the RLS DELETE policies.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seg_hijo_delete_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado text;
BEGIN
  IF pg_trigger_depth() > 1 OR auth.uid() IS NULL THEN
    RETURN OLD;
  END IF;

  SELECT a.estado
    INTO v_estado
  FROM public.cedulario_asignaciones a
  WHERE a.id = OLD.asignacion_id;

  IF FOUND AND v_estado <> 'activa' THEN
    RAISE EXCEPTION 'seguimiento.asignacion_inactiva' USING ERRCODE = 'CD012';
  END IF;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.seg_hijo_delete_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS seg_repasos_delete_guard ON public.materia_progreso_repasos;
CREATE TRIGGER seg_repasos_delete_guard
  BEFORE DELETE ON public.materia_progreso_repasos
  FOR EACH ROW EXECUTE FUNCTION public.seg_hijo_delete_guard();

DROP TRIGGER IF EXISTS seg_comentarios_delete_guard ON public.materia_progreso_comentarios;
CREATE TRIGGER seg_comentarios_delete_guard
  BEFORE DELETE ON public.materia_progreso_comentarios
  FOR EACH ROW EXECUTE FUNCTION public.seg_hijo_delete_guard();

DROP TRIGGER IF EXISTS seg_clases_delete_guard ON public.materia_progreso_clases;
CREATE TRIGGER seg_clases_delete_guard
  BEFORE DELETE ON public.materia_progreso_clases
  FOR EACH ROW EXECUTE FUNCTION public.seg_hijo_delete_guard();

-- =============================================================================
-- END OF SECTION 3: GUARD TRIGGER FUNCTIONS AND TRIGGERS
-- =============================================================================

-- =============================================================================
-- SECTION 4: AUDIT TRIGGER FUNCTION AND TRIGGERS
--
-- seguimiento_audit() writes the tracking events to historial_cambios. It
-- follows the convention of cedularios_audit() (migration 152) and runs AFTER
-- each row change, inside the transaction of the change it describes, so
-- history and data commit or roll back together. Clients still have no INSERT,
-- UPDATE or DELETE policy on historial_cambios.
--
--   INSERT  one row: campo 'created', valor_nuevo with the payload below
--   DELETE  one row: campo 'deleted', valor_anterior with the payload below
--   UPDATE  one row per column whose value actually changed (to_jsonb(OLD)
--           compared with to_jsonb(NEW)), except the ignored columns
--
-- Payload of created / deleted, by table:
--   cedulario_asignaciones        {id, etiqueta}
--   materia_progreso              {id, etiqueta}
--   materia_progreso_repasos      {id, fecha, nota}
--   materia_progreso_comentarios  {id, texto}
--   materia_progreso_clases       {id, horario_id}; on deleted also titulo of
--                                 the class when it still exists
--
-- Label (registro_etiqueta): nombre of the cedulario for cedulario_asignaciones;
-- "codigo nombre" of the materia for the four progress tables. Lookups tolerate
-- parent rows that are already gone (cascaded deletes), in which case the label
-- or the metadata value is NULL.
--
-- Columns audited in UPDATE (everything else is ignored):
--   cedulario_asignaciones        estado
--   materia_progreso              asignada, estado, fecha_cubierta, notas
--   materia_progreso_repasos      fecha, nota
--   materia_progreso_comentarios  texto
--   materia_progreso_clases       (no UPDATE exists)
-- Ignored in UPDATE: updated_at, updated_by, created_by, edited_at,
-- cubierta_por, cubierta_at, asignado_*, desasignado_*. The author columns also
-- turn NULL through ON DELETE SET NULL, and that is not a progress change. The
-- user and time of a change are already in usuario_id and created_at.
--
-- metadata = {asignacion_id, alumno_id} plus materia_id on the four progress
-- tables. historial_cambios.cedulario_id is the cedulario of the assignment
-- (NULL if the assignment row is already gone). There is no coalescing: unlike
-- the rich text fields of Phase 1, consecutive entries are never merged.
--
-- An operation that changes no value writes nothing: an idempotent coverage
-- update does not reach UPDATE, a repeated class link is skipped by
-- INSERT ... ON CONFLICT DO NOTHING, and the per-column diff skips equal values.
--
-- usuario_id is auth.uid() when it is a profile, or NULL for service role / SQL
-- editor calls and cascades without a session. JSON null is stored as SQL NULL
-- in valor_anterior / valor_nuevo ("empty").
--
-- SECURITY DEFINER with a pinned search_path so the function can write to
-- historial_cambios regardless of the caller's RLS.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.seguimiento_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old          jsonb;
  v_new          jsonb;
  v_row          jsonb;
  v_registro_id  uuid;
  v_asignacion_id uuid;
  v_alumno_id    uuid;
  v_cedulario_id uuid;
  v_materia_id   uuid;
  v_etiqueta     text;
  v_usuario_id   uuid;
  v_metadata     jsonb;
  v_resumen      jsonb;
  v_titulo       text;
  v_campo        text;
  v_valor_ant    jsonb;
  v_valor_nuevo  jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_row := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_row := to_jsonb(OLD);
  ELSE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_row := v_new;
  END IF;

  v_registro_id := (v_row ->> 'id')::uuid;

  -- Owning assignment, alumno and cedulario.
  IF TG_TABLE_NAME = 'cedulario_asignaciones' THEN
    v_asignacion_id := v_registro_id;
    v_alumno_id     := (v_row ->> 'alumno_id')::uuid;
    v_cedulario_id  := (v_row ->> 'cedulario_id')::uuid;
  ELSE
    v_asignacion_id := (v_row ->> 'asignacion_id')::uuid;
    -- No row found (assignment already deleted by a cascade) leaves both NULL.
    SELECT a.alumno_id, a.cedulario_id
    INTO v_alumno_id, v_cedulario_id
    FROM public.cedulario_asignaciones a
    WHERE a.id = v_asignacion_id;
  END IF;

  -- Materia of the progress row (progress tables only).
  IF TG_TABLE_NAME = 'materia_progreso' THEN
    v_materia_id := (v_row ->> 'materia_id')::uuid;
  ELSIF TG_TABLE_NAME <> 'cedulario_asignaciones' THEN
    -- No row found (progress row already deleted by a cascade) leaves it NULL.
    SELECT mp.materia_id
    INTO v_materia_id
    FROM public.materia_progreso mp
    WHERE mp.id = (v_row ->> 'progreso_id')::uuid;
  END IF;

  -- Human label at event time.
  IF TG_TABLE_NAME = 'cedulario_asignaciones' THEN
    SELECT c.nombre
    INTO v_etiqueta
    FROM public.cedularios c
    WHERE c.id = v_cedulario_id;
  ELSE
    SELECT NULLIF(btrim(m.codigo || ' ' || m.nombre), '')
    INTO v_etiqueta
    FROM public.materias m
    WHERE m.id = v_materia_id;
  END IF;

  -- Metadata used by the activity tab (filter by asignacion_id).
  v_metadata := jsonb_build_object(
    'asignacion_id', v_asignacion_id,
    'alumno_id', v_alumno_id
  );
  IF TG_TABLE_NAME <> 'cedulario_asignaciones' THEN
    v_metadata := v_metadata || jsonb_build_object('materia_id', v_materia_id);
  END IF;

  -- Acting user; only profiles can be referenced by historial_cambios.usuario_id.
  SELECT p.id INTO v_usuario_id
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF TG_OP IN ('INSERT', 'DELETE') THEN
    -- Payload of the created / deleted entry.
    IF TG_TABLE_NAME IN ('cedulario_asignaciones', 'materia_progreso') THEN
      v_resumen := jsonb_build_object('id', v_registro_id, 'etiqueta', v_etiqueta);
    ELSIF TG_TABLE_NAME = 'materia_progreso_repasos' THEN
      v_resumen := jsonb_build_object(
        'id', v_registro_id,
        'fecha', v_row -> 'fecha',
        'nota', v_row -> 'nota'
      );
    ELSIF TG_TABLE_NAME = 'materia_progreso_comentarios' THEN
      v_resumen := jsonb_build_object(
        'id', v_registro_id,
        'texto', v_row -> 'texto'
      );
    ELSE
      v_resumen := jsonb_build_object(
        'id', v_registro_id,
        'horario_id', v_row -> 'horario_id'
      );
      IF TG_OP = 'DELETE' THEN
        -- The class may be gone already (the link is deleted by its cascade).
        SELECT h.titulo
        INTO v_titulo
        FROM public.horarios h
        WHERE h.id = (v_row ->> 'horario_id')::uuid;

        IF v_titulo IS NOT NULL THEN
          v_resumen := v_resumen || jsonb_build_object('titulo', v_titulo);
        END IF;
      END IF;
    END IF;

    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.historial_cambios (
        cedulario_id, tabla, registro_id, registro_etiqueta,
        campo, valor_anterior, valor_nuevo, usuario_id, metadata
      ) VALUES (
        v_cedulario_id, TG_TABLE_NAME, v_registro_id, v_etiqueta,
        'created', NULL, v_resumen, v_usuario_id, v_metadata
      );
    ELSE
      INSERT INTO public.historial_cambios (
        cedulario_id, tabla, registro_id, registro_etiqueta,
        campo, valor_anterior, valor_nuevo, usuario_id, metadata
      ) VALUES (
        v_cedulario_id, TG_TABLE_NAME, v_registro_id, v_etiqueta,
        'deleted', v_resumen, NULL, v_usuario_id, v_metadata
      );
    END IF;

    RETURN NULL;
  END IF;

  -- UPDATE: one row per changed column.
  FOR v_campo IN SELECT jsonb_object_keys(v_new) LOOP
    IF v_campo IN (
      'updated_at', 'updated_by', 'created_by', 'edited_at',
      'cubierta_por', 'cubierta_at',
      'asignado_por', 'asignado_at', 'desasignado_por', 'desasignado_at'
    ) THEN
      CONTINUE;
    END IF;

    IF (v_old -> v_campo) IS NOT DISTINCT FROM (v_new -> v_campo) THEN
      CONTINUE;
    END IF;

    v_valor_ant   := NULLIF(v_old -> v_campo, 'null'::jsonb);
    v_valor_nuevo := NULLIF(v_new -> v_campo, 'null'::jsonb);

    INSERT INTO public.historial_cambios (
      cedulario_id, tabla, registro_id, registro_etiqueta,
      campo, valor_anterior, valor_nuevo, usuario_id, metadata
    ) VALUES (
      v_cedulario_id, TG_TABLE_NAME, v_registro_id, v_etiqueta,
      v_campo, v_valor_ant, v_valor_nuevo, v_usuario_id, v_metadata
    );
  END LOOP;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.seguimiento_audit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS cedulario_asignaciones_audit ON public.cedulario_asignaciones;
CREATE TRIGGER cedulario_asignaciones_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.cedulario_asignaciones
  FOR EACH ROW EXECUTE FUNCTION public.seguimiento_audit();

DROP TRIGGER IF EXISTS materia_progreso_audit ON public.materia_progreso;
CREATE TRIGGER materia_progreso_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.materia_progreso
  FOR EACH ROW EXECUTE FUNCTION public.seguimiento_audit();

DROP TRIGGER IF EXISTS materia_progreso_repasos_audit ON public.materia_progreso_repasos;
CREATE TRIGGER materia_progreso_repasos_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.materia_progreso_repasos
  FOR EACH ROW EXECUTE FUNCTION public.seguimiento_audit();

DROP TRIGGER IF EXISTS materia_progreso_comentarios_audit ON public.materia_progreso_comentarios;
CREATE TRIGGER materia_progreso_comentarios_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.materia_progreso_comentarios
  FOR EACH ROW EXECUTE FUNCTION public.seguimiento_audit();

DROP TRIGGER IF EXISTS materia_progreso_clases_audit ON public.materia_progreso_clases;
CREATE TRIGGER materia_progreso_clases_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.materia_progreso_clases
  FOR EACH ROW EXECUTE FUNCTION public.seguimiento_audit();

-- =============================================================================
-- END OF SECTION 4: AUDIT TRIGGER FUNCTION AND TRIGGERS
-- =============================================================================

-- =============================================================================
-- SECTION 5: ROW LEVEL SECURITY
--
-- One policy per table and command, always TO authenticated, with the role
-- resolved inside the expression. anon matches no policy, and there is no
-- multiple_permissive_policies advisory. get_user_rol() and auth.uid() are
-- wrapped in (select ...) so they are evaluated once per query.
--
-- Who can do what:
--   admin     reads and writes all five tables (write = manager of the alumno).
--   profesor  reads all five tables; writes only when the alumno is an own
--             alumno (puede_gestionar_seguimiento_alumno).
--   alumno    reads only its own activa assignments, the asignada = true
--             progress rows of those assignments and their children. No writes.
--   lector    and anon: nothing.
--
-- Rules kept by this section:
--   - Policies only call SECURITY DEFINER helpers and get_user_rol(). No policy
--     reads a table whose policy reads it back, so there is no recursion.
--   - Staff SELECT policies depend on the role only, never on a mutable column
--     (estado, asignada). A staff UPDATE ... RETURNING or INSERT ... RETURNING
--     therefore cannot fail the SELECT policy on the new row. Future changes
--     must keep this rule.
--   - Inactive alumno: RLS lets the manager write; the guard triggers reject
--     the write with CD011 unless the user is an admin.
--   - Comments: UPDATE and DELETE only for the author or an admin, and only
--     while the user still manages the alumno.
--   - materia_progreso_clases has no UPDATE policy: links are only created and
--     deleted.
--   - Phase 1 policies and the historial_cambios policies are not touched.
--     historial_cambios keeps no INSERT / UPDATE / DELETE policy for clients.
-- =============================================================================

ALTER TABLE public.cedulario_asignaciones        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materia_progreso              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materia_progreso_repasos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materia_progreso_comentarios  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materia_progreso_clases       ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- cedulario_asignaciones
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff ve asignaciones, alumno ve las suyas activas" ON public.cedulario_asignaciones;
CREATE POLICY "Staff ve asignaciones, alumno ve las suyas activas" ON public.cedulario_asignaciones
  FOR SELECT TO authenticated
  USING (
    (select public.get_user_rol()) IN ('admin', 'profesor')
    OR (
      alumno_id = (select auth.uid())
      AND estado = 'activa'
    )
  );

DROP POLICY IF EXISTS "Gestores crean asignaciones" ON public.cedulario_asignaciones;
CREATE POLICY "Gestores crean asignaciones" ON public.cedulario_asignaciones
  FOR INSERT TO authenticated
  WITH CHECK (public.puede_gestionar_seguimiento_alumno(alumno_id));

DROP POLICY IF EXISTS "Gestores actualizan asignaciones" ON public.cedulario_asignaciones;
CREATE POLICY "Gestores actualizan asignaciones" ON public.cedulario_asignaciones
  FOR UPDATE TO authenticated
  USING (public.puede_gestionar_seguimiento_alumno(alumno_id))
  WITH CHECK (public.puede_gestionar_seguimiento_alumno(alumno_id));

DROP POLICY IF EXISTS "Gestores eliminan asignaciones" ON public.cedulario_asignaciones;
CREATE POLICY "Gestores eliminan asignaciones" ON public.cedulario_asignaciones
  FOR DELETE TO authenticated
  USING (public.puede_gestionar_seguimiento_alumno(alumno_id));

-- ---------------------------------------------------------------------------
-- materia_progreso
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff ve progreso, alumno ve el asignado de sus asignaciones" ON public.materia_progreso;
CREATE POLICY "Staff ve progreso, alumno ve el asignado de sus asignaciones" ON public.materia_progreso
  FOR SELECT TO authenticated
  USING (
    (select public.get_user_rol()) IN ('admin', 'profesor')
    OR (
      asignada
      AND public.seg_alumno_ve_progreso(id)
    )
  );

DROP POLICY IF EXISTS "Gestores crean progreso" ON public.materia_progreso;
CREATE POLICY "Gestores crean progreso" ON public.materia_progreso
  FOR INSERT TO authenticated
  WITH CHECK (public.seg_puede_gestionar_asignacion(asignacion_id));

DROP POLICY IF EXISTS "Gestores actualizan progreso" ON public.materia_progreso;
CREATE POLICY "Gestores actualizan progreso" ON public.materia_progreso
  FOR UPDATE TO authenticated
  USING (public.seg_puede_gestionar_asignacion(asignacion_id))
  WITH CHECK (public.seg_puede_gestionar_asignacion(asignacion_id));

DROP POLICY IF EXISTS "Gestores eliminan progreso" ON public.materia_progreso;
CREATE POLICY "Gestores eliminan progreso" ON public.materia_progreso
  FOR DELETE TO authenticated
  USING (public.seg_puede_gestionar_asignacion(asignacion_id));

-- ---------------------------------------------------------------------------
-- materia_progreso_repasos
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff ve repasos, alumno ve los de su progreso" ON public.materia_progreso_repasos;
CREATE POLICY "Staff ve repasos, alumno ve los de su progreso" ON public.materia_progreso_repasos
  FOR SELECT TO authenticated
  USING (
    (select public.get_user_rol()) IN ('admin', 'profesor')
    OR public.seg_alumno_ve_progreso(progreso_id)
  );

DROP POLICY IF EXISTS "Gestores crean repasos" ON public.materia_progreso_repasos;
CREATE POLICY "Gestores crean repasos" ON public.materia_progreso_repasos
  FOR INSERT TO authenticated
  WITH CHECK (public.seg_puede_gestionar_asignacion(asignacion_id));

DROP POLICY IF EXISTS "Gestores actualizan repasos" ON public.materia_progreso_repasos;
CREATE POLICY "Gestores actualizan repasos" ON public.materia_progreso_repasos
  FOR UPDATE TO authenticated
  USING (public.seg_puede_gestionar_asignacion(asignacion_id))
  WITH CHECK (public.seg_puede_gestionar_asignacion(asignacion_id));

DROP POLICY IF EXISTS "Gestores eliminan repasos" ON public.materia_progreso_repasos;
CREATE POLICY "Gestores eliminan repasos" ON public.materia_progreso_repasos
  FOR DELETE TO authenticated
  USING (public.seg_puede_gestionar_asignacion(asignacion_id));

-- ---------------------------------------------------------------------------
-- materia_progreso_comentarios
-- created_by is forced to auth.uid() by seg_comentarios_guard, so it is
-- trustworthy here. UPDATE and DELETE: the author, or an admin, who also
-- manages the alumno.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff ve comentarios, alumno ve los de su progreso" ON public.materia_progreso_comentarios;
CREATE POLICY "Staff ve comentarios, alumno ve los de su progreso" ON public.materia_progreso_comentarios
  FOR SELECT TO authenticated
  USING (
    (select public.get_user_rol()) IN ('admin', 'profesor')
    OR public.seg_alumno_ve_progreso(progreso_id)
  );

DROP POLICY IF EXISTS "Gestores crean comentarios" ON public.materia_progreso_comentarios;
CREATE POLICY "Gestores crean comentarios" ON public.materia_progreso_comentarios
  FOR INSERT TO authenticated
  WITH CHECK (public.seg_puede_gestionar_asignacion(asignacion_id));

DROP POLICY IF EXISTS "Autor o admin actualizan comentarios" ON public.materia_progreso_comentarios;
CREATE POLICY "Autor o admin actualizan comentarios" ON public.materia_progreso_comentarios
  FOR UPDATE TO authenticated
  USING (
    public.seg_puede_gestionar_asignacion(asignacion_id)
    AND (
      created_by = (select auth.uid())
      OR (select public.get_user_rol()) = 'admin'
    )
  )
  WITH CHECK (
    public.seg_puede_gestionar_asignacion(asignacion_id)
    AND (
      created_by = (select auth.uid())
      OR (select public.get_user_rol()) = 'admin'
    )
  );

DROP POLICY IF EXISTS "Autor o admin eliminan comentarios" ON public.materia_progreso_comentarios;
CREATE POLICY "Autor o admin eliminan comentarios" ON public.materia_progreso_comentarios
  FOR DELETE TO authenticated
  USING (
    public.seg_puede_gestionar_asignacion(asignacion_id)
    AND (
      created_by = (select auth.uid())
      OR (select public.get_user_rol()) = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- materia_progreso_clases
-- No UPDATE policy: links are only created and deleted.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff ve clases vinculadas, alumno ve las de su progreso" ON public.materia_progreso_clases;
CREATE POLICY "Staff ve clases vinculadas, alumno ve las de su progreso" ON public.materia_progreso_clases
  FOR SELECT TO authenticated
  USING (
    (select public.get_user_rol()) IN ('admin', 'profesor')
    OR public.seg_alumno_ve_progreso(progreso_id)
  );

DROP POLICY IF EXISTS "Gestores crean clases vinculadas" ON public.materia_progreso_clases;
CREATE POLICY "Gestores crean clases vinculadas" ON public.materia_progreso_clases
  FOR INSERT TO authenticated
  WITH CHECK (public.seg_puede_gestionar_asignacion(asignacion_id));

DROP POLICY IF EXISTS "Gestores eliminan clases vinculadas" ON public.materia_progreso_clases;
CREATE POLICY "Gestores eliminan clases vinculadas" ON public.materia_progreso_clases
  FOR DELETE TO authenticated
  USING (public.seg_puede_gestionar_asignacion(asignacion_id));

-- =============================================================================
-- END OF SECTION 5: ROW LEVEL SECURITY
-- =============================================================================

-- =============================================================================
-- SECTION 6: WRITE RPC FUNCTIONS
--
-- All of them run as the caller (SECURITY INVOKER): RLS and the guard triggers
-- of section 3 stay the authority. Every function pins search_path, revokes
-- EXECUTE from PUBLIC and anon (Supabase grants it to anon by default) and
-- grants it to authenticated only.
--
-- Rule of the phase: operations that change the visibility of a row for the
-- caller (unassign, archive materias) never use UPDATE ... RETURNING; they read
-- the affected row count with GET DIAGNOSTICS ROW_COUNT instead.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- seg_motivo_de_sqlstate: maps the SQLSTATE of a failed per-alumno block to the
-- i18n reason code returned by asignar_cedulario_alumnos. Pure and IMMUTABLE.
-- Same table as motivoDeRechazo in TypeScript.
--   CD010 / 23505  asignacion_duplicada
--   CD011          alumno_no_valido
--   CD016          cedulario_no_disponible
--   42501          sin_permisos
--   anything else  error_generico
-- It has to be executable by authenticated because the caller of the invoker
-- RPC evaluates it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seg_motivo_de_sqlstate(p_sqlstate text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_sqlstate
    WHEN 'CD010' THEN 'asignacion_duplicada'
    WHEN '23505' THEN 'asignacion_duplicada'
    WHEN 'CD011' THEN 'alumno_no_valido'
    WHEN 'CD016' THEN 'cedulario_no_disponible'
    WHEN '42501' THEN 'sin_permisos'
    ELSE 'error_generico'
  END;
$$;

REVOKE ALL ON FUNCTION public.seg_motivo_de_sqlstate(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seg_motivo_de_sqlstate(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- seg_aplicar_subconjunto: internal helper of asignar_cedulario_alumnos.
-- Makes the assigned subset of an assignment equal to p_materia_ids:
--   - archives (asignada = false) the assigned rows of active materias that are
--     not in the set; rows of inactive materias are left alone so they still
--     count if the materia is restored
--   - restores (asignada = true) the archived rows that are in the set
--   - inserts the missing rows
-- Progress data (estado, notas, repasos, comentarios, clases) is never touched.
-- It is not a client API. It runs as the caller, so the grant to authenticated
-- is only needed for the invoker RPC that calls it; it is not listed in
-- lib/supabase/types.ts. To stay safe if it is called directly, it checks the
-- permission and the assignment state itself, on top of the guard triggers.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seg_aplicar_subconjunto(
  p_asignacion_id uuid,
  p_materia_ids   uuid[]
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_estado text;
BEGIN
  IF p_materia_ids IS NULL THEN
    RAISE EXCEPTION 'seguimiento.seleccion_materias_vacia' USING ERRCODE = '23514';
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT public.seg_puede_gestionar_asignacion(p_asignacion_id) THEN
    RAISE EXCEPTION 'seguimiento.sin_permisos' USING ERRCODE = '42501';
  END IF;

  SELECT a.estado INTO v_estado
  FROM public.cedulario_asignaciones a
  WHERE a.id = p_asignacion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'seguimiento.sin_permisos' USING ERRCODE = '42501';
  END IF;

  IF v_estado <> 'activa' THEN
    RAISE EXCEPTION 'seguimiento.asignacion_inactiva' USING ERRCODE = 'CD012';
  END IF;

  -- Archive the assigned rows that left the set.
  UPDATE public.materia_progreso mp
  SET asignada = false
  FROM public.materias m
  WHERE mp.asignacion_id = p_asignacion_id
    AND mp.asignada
    AND m.id = mp.materia_id
    AND m.activo
    AND NOT (mp.materia_id = ANY (p_materia_ids));

  -- Restore the archived rows that came back into the set.
  UPDATE public.materia_progreso mp
  SET asignada = true
  WHERE mp.asignacion_id = p_asignacion_id
    AND NOT mp.asignada
    AND mp.materia_id = ANY (p_materia_ids);

  -- Insert the rows that do not exist yet.
  INSERT INTO public.materia_progreso (asignacion_id, materia_id)
  SELECT p_asignacion_id, u.materia_id
  FROM (SELECT DISTINCT x AS materia_id FROM unnest(p_materia_ids) AS x WHERE x IS NOT NULL) u
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.materia_progreso mp
    WHERE mp.asignacion_id = p_asignacion_id
      AND mp.materia_id = u.materia_id
  )
  ON CONFLICT (asignacion_id, materia_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.seg_aplicar_subconjunto(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seg_aplicar_subconjunto(uuid, uuid[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- asignar_cedulario_alumnos: assigns one cedulario to several alumnos.
--   - more than 200 alumnos, or p_materia_ids = '{}': 23514
--   - p_materia_ids NULL means every active materia of the cedulario
--   - the materias are validated once (active, of this cedulario): CD014, and
--     the whole operation is rejected
--   - each alumno runs in its own sub-block with an EXCEPTION clause (a
--     subtransaction), so one failure does not affect the others
--   - resultado: asignado | reactivado | rechazado (motivo is the i18n code)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.asignar_cedulario_alumnos(
  p_cedulario_id uuid,
  p_alumno_ids   uuid[],
  p_materia_ids  uuid[] DEFAULT NULL
)
RETURNS TABLE (
  alumno_id     uuid,
  resultado     text,
  asignacion_id uuid,
  motivo        text
)
LANGUAGE plpgsql
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_uid      uuid := auth.uid();
  v_alumnos  uuid[];
  v_materias uuid[];
  v_validas  integer;
  v_alumno   uuid;
  v_asig_id  uuid;
  v_estado   text;
  v_resultado text;
  v_filas    integer;
BEGIN
  IF v_uid IS NOT NULL
     AND NOT COALESCE(public.get_user_rol() IN ('admin', 'profesor'), false) THEN
    RAISE EXCEPTION 'seguimiento.sin_permisos' USING ERRCODE = '42501';
  END IF;

  -- Distinct, non-null alumnos in the order they were sent.
  v_alumnos := ARRAY(
    SELECT u.a
    FROM unnest(COALESCE(p_alumno_ids, '{}'::uuid[])) WITH ORDINALITY AS u(a, n)
    WHERE u.a IS NOT NULL
    GROUP BY u.a
    ORDER BY min(u.n)
  );

  IF cardinality(v_alumnos) > 200 THEN
    RAISE EXCEPTION 'seguimiento.demasiados_alumnos' USING ERRCODE = '23514';
  END IF;

  IF p_materia_ids IS NOT NULL THEN
    v_materias := ARRAY(
      SELECT DISTINCT x FROM unnest(p_materia_ids) AS x WHERE x IS NOT NULL
    );

    IF cardinality(v_materias) = 0 THEN
      RAISE EXCEPTION 'seguimiento.seleccion_materias_vacia' USING ERRCODE = '23514';
    END IF;

    SELECT count(*) INTO v_validas
    FROM public.materias m
    WHERE m.id = ANY (v_materias)
      AND m.cedulario_id = p_cedulario_id
      AND m.activo;

    IF v_validas <> cardinality(v_materias) THEN
      RAISE EXCEPTION 'seguimiento.materia_invalida' USING ERRCODE = 'CD014';
    END IF;
  ELSE
    v_materias := ARRAY(
      SELECT m.id
      FROM public.materias m
      WHERE m.cedulario_id = p_cedulario_id
        AND m.activo
    );
  END IF;

  FOREACH v_alumno IN ARRAY v_alumnos LOOP
    BEGIN
      IF v_uid IS NOT NULL
         AND NOT public.puede_gestionar_seguimiento_alumno(v_alumno) THEN
        RAISE EXCEPTION 'seguimiento.sin_permisos' USING ERRCODE = '42501';
      END IF;

      v_asig_id := NULL;
      v_estado := NULL;

      SELECT a.id, a.estado INTO v_asig_id, v_estado
      FROM public.cedulario_asignaciones a
      WHERE a.cedulario_id = p_cedulario_id
        AND a.alumno_id = v_alumno;

      IF NOT FOUND THEN
        -- Guard: permission, CD011 (alumno valid and active), CD016 (cedulario active).
        INSERT INTO public.cedulario_asignaciones (cedulario_id, alumno_id)
        VALUES (p_cedulario_id, v_alumno)
        RETURNING id INTO v_asig_id;
        v_resultado := 'asignado';
      ELSIF v_estado = 'desasignada' THEN
        -- Re-assignment: the same row is reactivated and keeps its progress.
        UPDATE public.cedulario_asignaciones a
        SET estado = 'activa'
        WHERE a.id = v_asig_id
          AND a.estado = 'desasignada';
        GET DIAGNOSTICS v_filas = ROW_COUNT;

        IF v_filas = 0 THEN
          -- Somebody else reactivated it first.
          RAISE EXCEPTION 'seguimiento.asignacion_duplicada' USING ERRCODE = 'CD010';
        END IF;
        v_resultado := 'reactivado';
      ELSE
        RAISE EXCEPTION 'seguimiento.asignacion_duplicada' USING ERRCODE = 'CD010';
      END IF;

      PERFORM public.seg_aplicar_subconjunto(v_asig_id, v_materias);

      RETURN QUERY SELECT v_alumno, v_resultado, v_asig_id, NULL::text;
    EXCEPTION
      WHEN unique_violation THEN
        RETURN QUERY SELECT v_alumno, 'rechazado'::text, NULL::uuid, 'asignacion_duplicada'::text;
      WHEN OTHERS THEN
        RETURN QUERY SELECT v_alumno, 'rechazado'::text, NULL::uuid, public.seg_motivo_de_sqlstate(SQLSTATE);
    END;
  END LOOP;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.asignar_cedulario_alumnos(uuid, uuid[], uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.asignar_cedulario_alumnos(uuid, uuid[], uuid[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- desasignar_cedulario_alumno: sets the assignment to desasignada.
--   - returns true when the state changed, false when it was already
--     desasignada (idempotent)
--   - raises 42501 when the assignment does not exist or the caller cannot
--     manage that alumno
--   - never touches materia_progreso, and never uses RETURNING (the row stops
--     being visible to the alumno, and the rule of the phase is ROW_COUNT)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.desasignar_cedulario_alumno(p_asignacion_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_filas  integer;
  v_alumno uuid;
BEGIN
  UPDATE public.cedulario_asignaciones a
  SET estado = 'desasignada'
  WHERE a.id = p_asignacion_id
    AND a.estado = 'activa';
  GET DIAGNOSTICS v_filas = ROW_COUNT;

  IF v_filas > 0 THEN
    RETURN true;
  END IF;

  -- Nothing changed: already desasignada, or no permission, or no such row.
  v_alumno := public.seg_asignacion_alumno(p_asignacion_id);

  IF v_alumno IS NULL
     OR NOT public.puede_gestionar_seguimiento_alumno(v_alumno) THEN
    RAISE EXCEPTION 'seguimiento.sin_permisos' USING ERRCODE = '42501';
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.desasignar_cedulario_alumno(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.desasignar_cedulario_alumno(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- establecer_materias_asignadas: edits the assigned subset of an assignment.
--   - serialized per assignment with an advisory lock
--   - the assignment must be activa (CD012)
--   - p_agregar: active materias of the cedulario (CD014); the missing rows
--     are inserted and the archived ones are restored
--   - p_quitar: materias that have a row in the assignment (CD014); the rows
--     are archived (asignada = false), never deleted
--   - p_agregar and p_quitar must not overlap (23514)
--   - no progress data is modified; one transaction; no RETURNING
-- Returns {agregadas, restauradas, archivadas}.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.establecer_materias_asignadas(
  p_asignacion_id uuid,
  p_agregar       uuid[],
  p_quitar        uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_alumno      uuid;
  v_estado      text;
  v_cedulario   uuid;
  v_agregar     uuid[];
  v_quitar      uuid[];
  v_cuenta      integer;
  v_agregadas   integer := 0;
  v_restauradas integer := 0;
  v_archivadas  integer := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('seg_asignacion:' || p_asignacion_id::text, 0));

  SELECT a.alumno_id, a.estado, a.cedulario_id
    INTO v_alumno, v_estado, v_cedulario
  FROM public.cedulario_asignaciones a
  WHERE a.id = p_asignacion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'seguimiento.sin_permisos' USING ERRCODE = '42501';
  END IF;

  IF v_uid IS NOT NULL
     AND NOT public.puede_gestionar_seguimiento_alumno(v_alumno) THEN
    RAISE EXCEPTION 'seguimiento.sin_permisos' USING ERRCODE = '42501';
  END IF;

  IF v_estado <> 'activa' THEN
    RAISE EXCEPTION 'seguimiento.asignacion_inactiva' USING ERRCODE = 'CD012';
  END IF;

  v_agregar := ARRAY(
    SELECT DISTINCT x FROM unnest(COALESCE(p_agregar, '{}'::uuid[])) AS x WHERE x IS NOT NULL
  );
  v_quitar := ARRAY(
    SELECT DISTINCT x FROM unnest(COALESCE(p_quitar, '{}'::uuid[])) AS x WHERE x IS NOT NULL
  );

  IF v_agregar && v_quitar THEN
    RAISE EXCEPTION 'seguimiento.subconjunto_solapado' USING ERRCODE = '23514';
  END IF;

  IF cardinality(v_agregar) > 0 THEN
    SELECT count(*) INTO v_cuenta
    FROM public.materias m
    WHERE m.id = ANY (v_agregar)
      AND m.cedulario_id = v_cedulario
      AND m.activo;

    IF v_cuenta <> cardinality(v_agregar) THEN
      RAISE EXCEPTION 'seguimiento.materia_invalida' USING ERRCODE = 'CD014';
    END IF;
  END IF;

  IF cardinality(v_quitar) > 0 THEN
    SELECT count(*) INTO v_cuenta
    FROM public.materia_progreso mp
    WHERE mp.asignacion_id = p_asignacion_id
      AND mp.materia_id = ANY (v_quitar);

    IF v_cuenta <> cardinality(v_quitar) THEN
      RAISE EXCEPTION 'seguimiento.materia_invalida' USING ERRCODE = 'CD014';
    END IF;
  END IF;

  -- Restore the archived rows that come back.
  IF cardinality(v_agregar) > 0 THEN
    UPDATE public.materia_progreso mp
    SET asignada = true
    WHERE mp.asignacion_id = p_asignacion_id
      AND NOT mp.asignada
      AND mp.materia_id = ANY (v_agregar);
    GET DIAGNOSTICS v_restauradas = ROW_COUNT;

    -- Insert the rows that do not exist yet.
    INSERT INTO public.materia_progreso (asignacion_id, materia_id)
    SELECT p_asignacion_id, u.x
    FROM unnest(v_agregar) AS u(x)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.materia_progreso mp
      WHERE mp.asignacion_id = p_asignacion_id
        AND mp.materia_id = u.x
    )
    ON CONFLICT (asignacion_id, materia_id) DO NOTHING;
    GET DIAGNOSTICS v_agregadas = ROW_COUNT;
  END IF;

  -- Archive the rows that leave the subset.
  IF cardinality(v_quitar) > 0 THEN
    UPDATE public.materia_progreso mp
    SET asignada = false
    WHERE mp.asignacion_id = p_asignacion_id
      AND mp.asignada
      AND mp.materia_id = ANY (v_quitar);
    GET DIAGNOSTICS v_archivadas = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'agregadas', v_agregadas,
    'restauradas', v_restauradas,
    'archivadas', v_archivadas
  );
END;
$$;

REVOKE ALL ON FUNCTION public.establecer_materias_asignadas(uuid, uuid[], uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.establecer_materias_asignadas(uuid, uuid[], uuid[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- establecer_estado_materia: sets the DESIRED coverage state of a materia.
--   - absolute and idempotent: one conditional UPDATE whose WHERE compares
--     against the target, so repeating it changes nothing and writes no audit
--   - cubierta with a null date keeps the date if it was already cubierta, or
--     uses today (platform time zone); cubierta with a date sets that date
--   - pendiente ignores the date
--   - 42501 when the progress row does not exist or the caller cannot manage it
--   - the guard trigger applies CD011, CD012, CD014 and CD015
--   - cambio = false when the UPDATE matched no row (nothing to change)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.establecer_estado_materia(
  p_progreso_id uuid,
  p_estado      text,
  p_fecha       date DEFAULT NULL
)
RETURNS TABLE (
  estado         text,
  fecha_cubierta date,
  cambio         boolean
)
LANGUAGE plpgsql
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_alumno uuid;
  v_filas  integer;
BEGIN
  IF p_estado IS NULL OR p_estado NOT IN ('pendiente', 'cubierta') THEN
    RAISE EXCEPTION 'seguimiento.estado_invalido' USING ERRCODE = '23514';
  END IF;

  SELECT a.alumno_id INTO v_alumno
  FROM public.materia_progreso mp
  JOIN public.cedulario_asignaciones a ON a.id = mp.asignacion_id
  WHERE mp.id = p_progreso_id;

  IF v_alumno IS NULL
     OR (auth.uid() IS NOT NULL
         AND NOT public.puede_gestionar_seguimiento_alumno(v_alumno)) THEN
    RAISE EXCEPTION 'seguimiento.sin_permisos' USING ERRCODE = '42501';
  END IF;

  IF p_estado = 'cubierta' THEN
    UPDATE public.materia_progreso mp
    SET estado = 'cubierta',
        fecha_cubierta = COALESCE(p_fecha, mp.fecha_cubierta, public.seguimiento_hoy())
    WHERE mp.id = p_progreso_id
      AND (
        mp.estado <> 'cubierta'
        OR (p_fecha IS NOT NULL AND mp.fecha_cubierta IS DISTINCT FROM p_fecha)
      );
  ELSE
    UPDATE public.materia_progreso mp
    SET estado = 'pendiente',
        fecha_cubierta = NULL
    WHERE mp.id = p_progreso_id
      AND mp.estado <> 'pendiente';
  END IF;
  GET DIAGNOSTICS v_filas = ROW_COUNT;

  RETURN QUERY
  SELECT mp.estado, mp.fecha_cubierta, (v_filas > 0)
  FROM public.materia_progreso mp
  WHERE mp.id = p_progreso_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'seguimiento.sin_permisos' USING ERRCODE = '42501';
  END IF;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.establecer_estado_materia(uuid, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.establecer_estado_materia(uuid, text, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- vincular_clases_progreso: links several classes (horarios) to a progress row.
--   - returns the number of NEW links
--   - already linked classes are ignored (ON CONFLICT DO NOTHING): no error and
--     no audit entry
--   - all or nothing: a class of another alumno (CD013) rolls the whole call back
--   - the guard trigger derives asignacion_id and applies 42501, CD012, CD013
--     and CD014
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vincular_clases_progreso(
  p_progreso_id uuid,
  p_horario_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_alumno  uuid;
  v_horarios uuid[];
  v_nuevos  integer := 0;
BEGIN
  SELECT a.alumno_id INTO v_alumno
  FROM public.materia_progreso mp
  JOIN public.cedulario_asignaciones a ON a.id = mp.asignacion_id
  WHERE mp.id = p_progreso_id;

  IF v_alumno IS NULL
     OR (auth.uid() IS NOT NULL
         AND NOT public.puede_gestionar_seguimiento_alumno(v_alumno)) THEN
    RAISE EXCEPTION 'seguimiento.sin_permisos' USING ERRCODE = '42501';
  END IF;

  v_horarios := ARRAY(
    SELECT DISTINCT x FROM unnest(COALESCE(p_horario_ids, '{}'::uuid[])) AS x WHERE x IS NOT NULL
  );

  IF cardinality(v_horarios) = 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.materia_progreso_clases (progreso_id, horario_id)
  SELECT p_progreso_id, u.x
  FROM unnest(v_horarios) AS u(x)
  ON CONFLICT (progreso_id, horario_id) DO NOTHING;
  GET DIAGNOSTICS v_nuevos = ROW_COUNT;

  RETURN v_nuevos;
END;
$$;

REVOKE ALL ON FUNCTION public.vincular_clases_progreso(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vincular_clases_progreso(uuid, uuid[]) TO authenticated;

-- =============================================================================
-- END OF SECTION 6 (WRITE RPC FUNCTIONS)
-- =============================================================================

-- =============================================================================
-- SECTION 7: READ RPC FUNCTIONS (summary, progress, detail, activity, lists)
--
-- SECURITY INVOKER where RLS can decide what the caller sees:
--   get_alumno_cedularios_resumen, get_cedulario_alumnos_resumen,
--   get_asignacion_progreso, listar_alumnos_asignables,
--   contar_alumnos_materia_asignada
-- SECURITY DEFINER with an explicit role check inside, because RLS of Phase 1
-- or of profiles would hide rows the staff legitimately needs (author names,
-- inactive materias, classes of other profesores, activity of the assignment):
--   get_progreso_detalle, get_asignacion_materias_inactivas,
--   get_asignacion_actividad, listar_clases_vinculables
--
-- All of them pin search_path, revoke EXECUTE from PUBLIC and anon (Supabase
-- grants it to anon by default) and grant it to authenticated only.
--
-- Percentages: porcentaje = round(100.0 * cubiertas / total) over numeric, or
-- NULL when total = 0. Only rows with asignada AND materia.activo of
-- assignments in estado 'activa' count (the same definition as the tree of the
-- reviewer on the client).
--
-- Phase 1 RLS hides inactive cedularios, universidades and materias from every
-- role but admin. The INVOKER summaries use LEFT JOINs on them, so an
-- assignment whose cedulario is hidden still comes back: cedulario_nombre is
-- NULL, cedulario_activo is false and the totals are 0 (percentage NULL). The
-- reviewer shows "cedulario no disponible" for that case.
--
-- Pagination: LIMIT is clamped to 1..100 (NULL means 50) and OFFSET to >= 0.
-- Searches use ILIKE with the escape of seg_like_patron (max 100 characters).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- seg_like_patron: builds an ILIKE pattern from free text.
--   - NULL or blank text gives NULL (no filter)
--   - the text is cut to 100 characters and trimmed
--   - backslash, % and _ are escaped, so they match literally (ILIKE uses the
--     backslash as the default escape character)
-- Pure and IMMUTABLE; callers of the invoker RPC evaluate it, so it is
-- granted to authenticated.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seg_like_patron(p_q text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_q IS NULL OR btrim(p_q) = '' THEN NULL
    ELSE '%' || replace(replace(replace(btrim(left(p_q, 100)), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  END;
$$;

REVOKE ALL ON FUNCTION public.seg_like_patron(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seg_like_patron(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- get_alumno_cedularios_resumen: one query per alumno for hover card, student
-- file, reviewer header and cedulario selector.
--   - starts from profiles with LEFT JOINs: an alumno without assignments
--     returns ONE row whose assignment columns are NULL
--   - zero rows when the profile is not visible, is not an alumno, or the
--     caller is a lector; an alumno only gets its own rows (RLS on profiles)
--   - desasignadas only when p_incluir_desasignadas is true and the caller is
--     staff
--   - puede_editar = puede_gestionar_seguimiento_alumno(alumno)
--   - ultima_actividad: newest historial_cambios row of the assignment (served
--     by idx_historial_asignacion); only staff can read that table, so it is
--     NULL for an alumno
--   - order: activas first, then by cedulario name
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_alumno_cedularios_resumen(
  p_alumno_id            uuid,
  p_incluir_desasignadas boolean DEFAULT false
)
RETURNS TABLE (
  alumno_id               uuid,
  alumno_nombre           text,
  alumno_apellido         text,
  alumno_apellido_materno text,
  alumno_email            text,
  alumno_avatar_url       text,
  alumno_activo           boolean,
  puede_editar            boolean,
  asignacion_id           uuid,
  cedulario_id            uuid,
  cedulario_nombre        text,
  cedulario_version       text,
  cedulario_activo        boolean,
  universidad_id          uuid,
  universidad_nombre      text,
  estado                  text,
  asignado_at             timestamptz,
  desasignado_at          timestamptz,
  total_asignadas         integer,
  total_cubiertas         integer,
  porcentaje              integer,
  ultima_actividad        timestamptz
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p.id,
         p.nombre::text,
         p.apellido::text,
         p.apellido_materno::text,
         p.email::text,
         p.avatar_url::text,
         p.activo,
         public.puede_gestionar_seguimiento_alumno(p.id),
         a.id,
         a.cedulario_id,
         c.nombre::text,
         c.version::text,
         CASE WHEN a.id IS NULL THEN NULL ELSE COALESCE(c.activo, false) END,
         c.universidad_id,
         u.nombre::text,
         a.estado::text,
         a.asignado_at,
         a.desasignado_at,
         CASE WHEN a.id IS NULL THEN NULL ELSE t.total_asignadas END,
         CASE WHEN a.id IS NULL THEN NULL ELSE t.total_cubiertas END,
         CASE
           WHEN a.id IS NULL OR t.total_asignadas = 0 THEN NULL
           ELSE round(100.0 * t.total_cubiertas / t.total_asignadas)::integer
         END,
         act.ultima
  FROM public.profiles p
  LEFT JOIN public.cedulario_asignaciones a
    ON a.alumno_id = p.id
   AND (
     a.estado = 'activa'
     OR (
       COALESCE(p_incluir_desasignadas, false)
       AND COALESCE(public.get_user_rol() IN ('admin', 'profesor'), false)
     )
   )
  LEFT JOIN public.cedularios c ON c.id = a.cedulario_id
  LEFT JOIN public.universidades u ON u.id = c.universidad_id
  LEFT JOIN LATERAL (
    SELECT count(*)::integer AS total_asignadas,
           (count(*) FILTER (WHERE mp.estado = 'cubierta'))::integer AS total_cubiertas
    FROM public.materia_progreso mp
    JOIN public.materias m ON m.id = mp.materia_id
    WHERE mp.asignacion_id = a.id
      AND mp.asignada
      AND m.activo
  ) t ON true
  LEFT JOIN LATERAL (
    SELECT max(h.created_at) AS ultima
    FROM public.historial_cambios h
    WHERE (h.metadata ->> 'asignacion_id')::uuid = a.id
      AND h.metadata ->> 'asignacion_id' IS NOT NULL
  ) act ON true
  WHERE p.id = p_alumno_id
    AND p.rol = 'alumno'
    AND COALESCE(public.get_user_rol() IN ('admin', 'profesor', 'alumno'), false)
  ORDER BY a.estado, c.nombre, a.id;
$$;

REVOKE ALL ON FUNCTION public.get_alumno_cedularios_resumen(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_alumno_cedularios_resumen(uuid, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- get_cedulario_alumnos_resumen: alumnos with an activa assignment of a
-- cedulario, for the "Alumnos" tab.
--   - staff only (admin, profesor); any other role gets no rows
--   - search by nombre, apellido, "nombre apellido" or email
--   - ORDER BY apellido, nombre, alumno_id; total_filas = count(*) OVER () of
--     the filtered set, repeated in every row of the page (so it is lost when
--     the offset is past the last row)
--   - the page is cut first (CTE) and the totals are computed only for its rows
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_cedulario_alumnos_resumen(
  p_cedulario_id uuid,
  p_q            text    DEFAULT NULL,
  p_limit        integer DEFAULT 50,
  p_offset       integer DEFAULT 0
)
RETURNS TABLE (
  asignacion_id    uuid,
  alumno_id        uuid,
  nombre           text,
  apellido         text,
  apellido_materno text,
  email            text,
  avatar_url       text,
  alumno_activo    boolean,
  asignado_at      timestamptz,
  ultima_actividad timestamptz,
  total_asignadas  integer,
  total_cubiertas  integer,
  porcentaje       integer,
  puede_editar     boolean,
  total_filas      bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH base AS (
    SELECT a.id AS b_asignacion_id,
           p.id AS b_alumno_id,
           p.nombre AS b_nombre,
           p.apellido AS b_apellido,
           p.apellido_materno AS b_apellido_materno,
           p.email AS b_email,
           p.avatar_url AS b_avatar_url,
           p.activo AS b_alumno_activo,
           a.asignado_at AS b_asignado_at,
           count(*) OVER () AS b_total
    FROM public.cedulario_asignaciones a
    JOIN public.profiles p ON p.id = a.alumno_id AND p.rol = 'alumno'
    WHERE a.cedulario_id = p_cedulario_id
      AND a.estado = 'activa'
      AND COALESCE(public.get_user_rol() IN ('admin', 'profesor'), false)
      AND (
        public.seg_like_patron(p_q) IS NULL
        OR p.nombre ILIKE public.seg_like_patron(p_q)
        OR p.apellido ILIKE public.seg_like_patron(p_q)
        OR concat_ws(' ', p.nombre, p.apellido) ILIKE public.seg_like_patron(p_q)
        OR p.email ILIKE public.seg_like_patron(p_q)
      )
    ORDER BY p.apellido, p.nombre, p.id
    LIMIT CASE WHEN p_limit IS NULL OR p_limit < 1 THEN 50 ELSE least(p_limit, 100) END
    OFFSET greatest(COALESCE(p_offset, 0), 0)
  )
  SELECT b.b_asignacion_id,
         b.b_alumno_id,
         b.b_nombre::text,
         b.b_apellido::text,
         b.b_apellido_materno::text,
         b.b_email::text,
         b.b_avatar_url::text,
         b.b_alumno_activo,
         b.b_asignado_at,
         act.ultima,
         t.total_asignadas,
         t.total_cubiertas,
         CASE
           WHEN t.total_asignadas = 0 THEN NULL
           ELSE round(100.0 * t.total_cubiertas / t.total_asignadas)::integer
         END,
         public.puede_gestionar_seguimiento_alumno(b.b_alumno_id),
         b.b_total
  FROM base b
  LEFT JOIN LATERAL (
    SELECT count(*)::integer AS total_asignadas,
           (count(*) FILTER (WHERE mp.estado = 'cubierta'))::integer AS total_cubiertas
    FROM public.materia_progreso mp
    JOIN public.materias m ON m.id = mp.materia_id
    WHERE mp.asignacion_id = b.b_asignacion_id
      AND mp.asignada
      AND m.activo
  ) t ON true
  LEFT JOIN LATERAL (
    SELECT max(h.created_at) AS ultima
    FROM public.historial_cambios h
    WHERE (h.metadata ->> 'asignacion_id')::uuid = b.b_asignacion_id
      AND h.metadata ->> 'asignacion_id' IS NOT NULL
  ) act ON true
  ORDER BY b.b_apellido, b.b_nombre, b.b_alumno_id;
$$;

REVOKE ALL ON FUNCTION public.get_cedulario_alumnos_resumen(uuid, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_cedulario_alumnos_resumen(uuid, text, integer, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- get_asignacion_progreso: flat list of the progress rows of an assignment,
-- with the number of repasos, comentarios and linked classes of each row.
--   - counts come from grouped subqueries filtered by asignacion_id (served by
--     idx_repasos_asignacion, idx_comentarios_asignacion, idx_clases_asignacion)
--   - RLS decides what each role sees: an alumno only gets asignada = true rows
--     of its own activa assignment
--   - rows of inactive materias and archived rows (asignada = false) are
--     returned too; the client decides what to show
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_asignacion_progreso(p_asignacion_id uuid)
RETURNS TABLE (
  id             uuid,
  materia_id     uuid,
  asignada       boolean,
  estado         text,
  fecha_cubierta date,
  cubierta_por   uuid,
  cubierta_at    timestamptz,
  notas          text,
  repasos        integer,
  comentarios    integer,
  clases         integer,
  updated_at     timestamptz
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT mp.id,
         mp.materia_id,
         mp.asignada,
         mp.estado::text,
         mp.fecha_cubierta,
         mp.cubierta_por,
         mp.cubierta_at,
         mp.notas::text,
         COALESCE(r.n, 0)::integer,
         COALESCE(c.n, 0)::integer,
         COALESCE(k.n, 0)::integer,
         mp.updated_at
  FROM public.materia_progreso mp
  LEFT JOIN (
    SELECT x.progreso_id, count(*) AS n
    FROM public.materia_progreso_repasos x
    WHERE x.asignacion_id = p_asignacion_id
    GROUP BY x.progreso_id
  ) r ON r.progreso_id = mp.id
  LEFT JOIN (
    SELECT x.progreso_id, count(*) AS n
    FROM public.materia_progreso_comentarios x
    WHERE x.asignacion_id = p_asignacion_id
    GROUP BY x.progreso_id
  ) c ON c.progreso_id = mp.id
  LEFT JOIN (
    SELECT x.progreso_id, count(*) AS n
    FROM public.materia_progreso_clases x
    WHERE x.asignacion_id = p_asignacion_id
    GROUP BY x.progreso_id
  ) k ON k.progreso_id = mp.id
  WHERE mp.asignacion_id = p_asignacion_id;
$$;

REVOKE ALL ON FUNCTION public.get_asignacion_progreso(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_asignacion_progreso(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- get_progreso_detalle: comments, repasos and linked classes of one progress
-- row in a single round trip.
--   - SECURITY DEFINER: names of authors (profiles) and classes of other
--     profesores would be hidden by RLS
--   - permission: admin or profesor, or the owner alumno when the row is
--     visible to them (seg_alumno_ve_progreso); anybody else, or an unknown
--     row, gets the three lists empty (no error, nothing leaks)
--   - shape of the jsonb (read by parseProgresoDetalle in TypeScript):
--       comentarios [{id, texto, created_by, autor_nombre, created_at, edited_at}]
--                   oldest first
--       repasos     [{id, fecha, nota, created_by, autor_nombre, created_at}]
--                   by fecha DESC, created_at DESC
--       clases      [{id, horario_id, titulo, fecha, hora_inicio, activo}]
--                   id is the id of the link; newest class first
--   - autor_nombre is "nombre apellido", or null when the profile is gone
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_progreso_detalle(p_progreso_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_permitido boolean;
  v_resultado jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'comentarios', '[]'::jsonb,
      'repasos', '[]'::jsonb,
      'clases', '[]'::jsonb
    );
  END IF;

  v_permitido := COALESCE(public.get_user_rol() IN ('admin', 'profesor'), false)
                 OR public.seg_alumno_ve_progreso(p_progreso_id);

  IF NOT v_permitido
     OR NOT EXISTS (SELECT 1 FROM public.materia_progreso mp WHERE mp.id = p_progreso_id) THEN
    RETURN jsonb_build_object(
      'comentarios', '[]'::jsonb,
      'repasos', '[]'::jsonb,
      'clases', '[]'::jsonb
    );
  END IF;

  SELECT jsonb_build_object(
    'comentarios', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'texto', c.texto,
          'created_by', c.created_by,
          'autor_nombre', NULLIF(btrim(COALESCE(pc.nombre, '') || ' ' || COALESCE(pc.apellido, '')), ''),
          'created_at', c.created_at,
          'edited_at', c.edited_at
        )
        ORDER BY c.created_at, c.id
      )
      FROM public.materia_progreso_comentarios c
      LEFT JOIN public.profiles pc ON pc.id = c.created_by
      WHERE c.progreso_id = p_progreso_id
    ), '[]'::jsonb),
    'repasos', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'fecha', r.fecha,
          'nota', r.nota,
          'created_by', r.created_by,
          'autor_nombre', NULLIF(btrim(COALESCE(pr.nombre, '') || ' ' || COALESCE(pr.apellido, '')), ''),
          'created_at', r.created_at
        )
        ORDER BY r.fecha DESC, r.created_at DESC, r.id DESC
      )
      FROM public.materia_progreso_repasos r
      LEFT JOIN public.profiles pr ON pr.id = r.created_by
      WHERE r.progreso_id = p_progreso_id
    ), '[]'::jsonb),
    'clases', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', k.id,
          'horario_id', k.horario_id,
          'titulo', h.titulo,
          'fecha', h.fecha,
          'hora_inicio', h.hora_inicio,
          'activo', h.activo
        )
        ORDER BY h.fecha DESC, h.hora_inicio DESC, k.id DESC
      )
      FROM public.materia_progreso_clases k
      JOIN public.horarios h ON h.id = k.horario_id
      WHERE k.progreso_id = p_progreso_id
    ), '[]'::jsonb)
  )
  INTO v_resultado;

  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.get_progreso_detalle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_progreso_detalle(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- get_asignacion_materias_inactivas: materias with activo = false that have a
-- progress row in the assignment, with their coverage state and the number of
-- repasos and comentarios.
--   - SECURITY DEFINER: Phase 1 RLS hides inactive materias from everybody but
--     admin, and the profesor must see them here (Req 13.7)
--   - staff only (admin, profesor); any other role gets no rows
--   - order: codigo, nombre
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_asignacion_materias_inactivas(p_asignacion_id uuid)
RETURNS TABLE (
  materia_id     uuid,
  codigo         text,
  nombre         text,
  nivel          integer,
  parent_id      uuid,
  estado         text,
  fecha_cubierta date,
  repasos        integer,
  comentarios    integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id,
         m.codigo::text,
         m.nombre::text,
         m.nivel::integer,
         m.parent_id,
         mp.estado::text,
         mp.fecha_cubierta,
         COALESCE(r.n, 0)::integer,
         COALESCE(c.n, 0)::integer
  FROM public.materia_progreso mp
  JOIN public.materias m ON m.id = mp.materia_id
  LEFT JOIN (
    SELECT x.progreso_id, count(*) AS n
    FROM public.materia_progreso_repasos x
    WHERE x.asignacion_id = p_asignacion_id
    GROUP BY x.progreso_id
  ) r ON r.progreso_id = mp.id
  LEFT JOIN (
    SELECT x.progreso_id, count(*) AS n
    FROM public.materia_progreso_comentarios x
    WHERE x.asignacion_id = p_asignacion_id
    GROUP BY x.progreso_id
  ) c ON c.progreso_id = mp.id
  WHERE mp.asignacion_id = p_asignacion_id
    AND NOT m.activo
    AND auth.uid() IS NOT NULL
    AND COALESCE(public.get_user_rol() IN ('admin', 'profesor'), false)
  ORDER BY m.codigo, m.nombre, m.id;
$$;

REVOKE ALL ON FUNCTION public.get_asignacion_materias_inactivas(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_asignacion_materias_inactivas(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- get_asignacion_actividad: change history of one assignment, newest first,
-- with keyset pagination. Same shape as get_historial_cedulario.
--   - admin and profesor only; any other role gets no rows. A profesor also
--     needs the cedulario of the assignment to be active (same rule as
--     get_historial_cedulario); admin may read it whatever the state
--   - filter: (metadata->>'asignacion_id')::uuid = p_asignacion_id, served by
--     the partial index idx_historial_asignacion
--   - ORDER BY created_at DESC, id DESC; the next page is requested with the
--     created_at and id of the last row received
--   - LIMIT least(p_limit, 100); p_limit NULL or below 1 means 50
--   - usuario_nombre is "nombre apellido", NULL when usuario_id is NULL or the
--     profile no longer exists
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_asignacion_actividad(
  p_asignacion_id     uuid,
  p_limit             integer     DEFAULT 50,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id         uuid        DEFAULT NULL
)
RETURNS TABLE (
  id                uuid,
  cedulario_id      uuid,
  tabla             text,
  registro_id       uuid,
  registro_etiqueta text,
  campo             text,
  valor_anterior    jsonb,
  valor_nuevo       jsonb,
  usuario_id        uuid,
  metadata          jsonb,
  created_at        timestamptz,
  usuario_nombre    text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_rol    text;
  v_limite integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  v_rol := public.get_user_rol()::text;

  IF v_rol IS NULL OR v_rol NOT IN ('admin', 'profesor') THEN
    RETURN;
  END IF;

  IF v_rol <> 'admin' AND NOT EXISTS (
    SELECT 1
    FROM public.cedulario_asignaciones a
    JOIN public.cedularios c ON c.id = a.cedulario_id
    WHERE a.id = p_asignacion_id
      AND c.activo
  ) THEN
    RETURN;
  END IF;

  v_limite := CASE
    WHEN p_limit IS NULL OR p_limit < 1 THEN 50
    ELSE least(p_limit, 100)
  END;

  RETURN QUERY
  SELECT h.id,
         h.cedulario_id,
         h.tabla,
         h.registro_id,
         h.registro_etiqueta,
         h.campo,
         h.valor_anterior,
         h.valor_nuevo,
         h.usuario_id,
         h.metadata,
         h.created_at,
         NULLIF(btrim(COALESCE(p.nombre, '') || ' ' || COALESCE(p.apellido, '')), '')
  FROM public.historial_cambios h
  LEFT JOIN public.profiles p ON p.id = h.usuario_id
  WHERE (h.metadata ->> 'asignacion_id')::uuid = p_asignacion_id
    AND h.metadata ->> 'asignacion_id' IS NOT NULL
    AND (
      p_cursor_created_at IS NULL
      OR (p_cursor_id IS NULL AND h.created_at < p_cursor_created_at)
      OR (p_cursor_id IS NOT NULL AND (h.created_at, h.id) < (p_cursor_created_at, p_cursor_id))
    )
  ORDER BY h.created_at DESC, h.id DESC
  LIMIT v_limite;
END;
$$;

REVOKE ALL ON FUNCTION public.get_asignacion_actividad(uuid, integer, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_asignacion_actividad(uuid, integer, timestamptz, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- listar_alumnos_asignables: active alumnos the caller can assign a cedulario
-- to, for the alumnos selector of the assign dialog.
--   - only profiles with rol 'alumno' and activo = true
--   - admin gets every alumno; a profesor only gets own alumnos
--     (puede_gestionar_seguimiento_alumno covers both); other roles get nothing
--   - ya_asignado: the alumno has an activa assignment of p_cedulario_id (always
--     false when p_cedulario_id is NULL)
--   - search by nombre, apellido, "nombre apellido" or email
--   - ORDER BY apellido, nombre, id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.listar_alumnos_asignables(
  p_cedulario_id uuid    DEFAULT NULL,
  p_q            text    DEFAULT NULL,
  p_limit        integer DEFAULT 50,
  p_offset       integer DEFAULT 0
)
RETURNS TABLE (
  id               uuid,
  nombre           text,
  apellido         text,
  apellido_materno text,
  email            text,
  avatar_url       text,
  ya_asignado      boolean
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p.id,
         p.nombre::text,
         p.apellido::text,
         p.apellido_materno::text,
         p.email::text,
         p.avatar_url::text,
         (
           p_cedulario_id IS NOT NULL
           AND EXISTS (
             SELECT 1
             FROM public.cedulario_asignaciones a
             WHERE a.cedulario_id = p_cedulario_id
               AND a.alumno_id = p.id
               AND a.estado = 'activa'
           )
         )
  FROM public.profiles p
  WHERE p.rol = 'alumno'
    AND p.activo
    AND COALESCE(public.get_user_rol() IN ('admin', 'profesor'), false)
    AND public.puede_gestionar_seguimiento_alumno(p.id)
    AND (
      public.seg_like_patron(p_q) IS NULL
      OR p.nombre ILIKE public.seg_like_patron(p_q)
      OR p.apellido ILIKE public.seg_like_patron(p_q)
      OR concat_ws(' ', p.nombre, p.apellido) ILIKE public.seg_like_patron(p_q)
      OR p.email ILIKE public.seg_like_patron(p_q)
    )
  ORDER BY p.apellido, p.nombre, p.id
  LIMIT CASE WHEN p_limit IS NULL OR p_limit < 1 THEN 50 ELSE least(p_limit, 100) END
  OFFSET greatest(COALESCE(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.listar_alumnos_asignables(uuid, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_alumnos_asignables(uuid, text, integer, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- listar_clases_vinculables: classes (horarios) of the alumno of an assignment
-- that can be linked to its materias, newest first.
--   - SECURITY DEFINER: the alumno may have classes with other profesores, and
--     RLS on horarios would hide them
--   - only a manager of the alumno (seg_puede_gestionar_asignacion); anybody
--     else, or an unknown assignment, gets no rows
--   - horarios.alumno_id = alumno of the assignment; includes inactive classes
--     (the flag activo is returned)
--   - ya_vinculada: the class is already linked to ANY progress row of this
--     assignment (the function does not receive a progress id)
--   - search by titulo or by date, written YYYY-MM-DD or DD/MM/YYYY (partial
--     text matches too); the date is compared as text, so a malformed date
--     never raises an error
--   - ORDER BY fecha DESC, hora_inicio DESC, id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.listar_clases_vinculables(
  p_asignacion_id uuid,
  p_q             text    DEFAULT NULL,
  p_limit         integer DEFAULT 50,
  p_offset        integer DEFAULT 0
)
RETURNS TABLE (
  id          uuid,
  titulo      text,
  fecha       date,
  hora_inicio time,
  hora_fin    time,
  activo      boolean,
  ya_vinculada boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.id,
         h.titulo::text,
         h.fecha,
         h.hora_inicio,
         h.hora_fin,
         h.activo,
         EXISTS (
           SELECT 1
           FROM public.materia_progreso_clases k
           WHERE k.asignacion_id = p_asignacion_id
             AND k.horario_id = h.id
         )
  FROM public.horarios h
  WHERE auth.uid() IS NOT NULL
    AND public.seg_puede_gestionar_asignacion(p_asignacion_id)
    AND h.alumno_id = public.seg_asignacion_alumno(p_asignacion_id)
    AND (
      public.seg_like_patron(p_q) IS NULL
      OR h.titulo ILIKE public.seg_like_patron(p_q)
      OR to_char(h.fecha, 'YYYY-MM-DD') ILIKE public.seg_like_patron(p_q)
      OR to_char(h.fecha, 'DD/MM/YYYY') ILIKE public.seg_like_patron(p_q)
    )
  ORDER BY h.fecha DESC, h.hora_inicio DESC, h.id
  LIMIT CASE WHEN p_limit IS NULL OR p_limit < 1 THEN 50 ELSE least(p_limit, 100) END
  OFFSET greatest(COALESCE(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.listar_clases_vinculables(uuid, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_clases_vinculables(uuid, text, integer, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- contar_alumnos_materia_asignada: number of distinct alumnos with an activa
-- assignment and a progress row asignada = true on the materia or on any of its
-- active descendants. Used by the confirmation dialog before deactivating or
-- deleting a materia (Req 13.6).
--   - recursive walk down parent_id; UNION (not UNION ALL) so a corrupt cycle
--     cannot loop forever. The materia itself is always included
--   - staff only (admin, profesor); any other role gets 0
--   - INVOKER: RLS of Phase 1 and of the tracking tables stays the authority
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contar_alumnos_materia_asignada(p_materia_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH RECURSIVE rama AS (
    SELECT m.id
    FROM public.materias m
    WHERE m.id = p_materia_id
    UNION
    SELECT hijo.id
    FROM public.materias hijo
    JOIN rama r ON hijo.parent_id = r.id
    WHERE hijo.activo
  )
  SELECT count(DISTINCT a.alumno_id)::integer
  FROM rama r
  JOIN public.materia_progreso mp ON mp.materia_id = r.id AND mp.asignada
  JOIN public.cedulario_asignaciones a ON a.id = mp.asignacion_id AND a.estado = 'activa'
  WHERE COALESCE(public.get_user_rol() IN ('admin', 'profesor'), false);
$$;

REVOKE ALL ON FUNCTION public.contar_alumnos_materia_asignada(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contar_alumnos_materia_asignada(uuid) TO authenticated;

-- =============================================================================
-- END OF SECTION 7 (READ RPC FUNCTIONS)
-- =============================================================================

-- =============================================================================
-- SECTION 8: REDEFINITIONS OF PHASE 1 FUNCTIONS
--
-- Two Phase 1 functions are redefined with CREATE OR REPLACE. The bodies below
-- were copied from the version in use in the database (pg_get_functiondef),
-- which matches 152_sistema_cedularios.sql (153 does not touch them).
-- Signature, language, volatility, security, search_path and permissions are
-- kept as they were.
--
--   desactivar_cedulario     the only difference with the original body is the
--                            BEGIN ... EXCEPTION block that re-raises CD008
--                            with DETAIL = number of active assignments
--   get_historial_cedulario  the only difference with the original body is the
--                            added line
--                            AND NOT (h.tabla = ANY (public.seguimiento_tablas()))
--                            so tracking events stay out of the Phase 1 history
-- =============================================================================

-- ---------------------------------------------------------------------------
-- desactivar_cedulario: soft delete without a RETURNING clause (unchanged).
-- When cedularios_guard raises CD008 (the cedulario has active assignments),
-- the error is raised again with the same code and message plus the number of
-- active assignments in DETAIL, so the UI can show a count (Req 13.3).
-- The count is read in the handler, after the failed UPDATE was rolled back.
-- SECURITY INVOKER, as in Phase 1.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.desactivar_cedulario(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_filas   integer;
  v_activas integer;
BEGIN
  BEGIN
    UPDATE public.cedularios
    SET activo = false
    WHERE id = p_id
      AND activo;

    GET DIAGNOSTICS v_filas = ROW_COUNT;
  EXCEPTION
    WHEN SQLSTATE 'CD008' THEN
      SELECT count(*)::integer
      INTO v_activas
      FROM public.cedulario_asignaciones a
      WHERE a.cedulario_id = p_id
        AND a.estado = 'activa';

      RAISE EXCEPTION '%', SQLERRM
        USING ERRCODE = 'CD008',
              DETAIL = COALESCE(v_activas, 0)::text;
  END;

  RETURN v_filas > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.desactivar_cedulario(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.desactivar_cedulario(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- get_historial_cedulario: Phase 1 change history, newest first, keyset
-- pagination (unchanged). The added line hides the audit rows of the five
-- tracking tables; they are read through get_asignacion_actividad instead
-- (Req 12.10).
-- SECURITY DEFINER, STABLE, as in Phase 1.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_historial_cedulario(
  p_cedulario_id      uuid,
  p_tabla             text        DEFAULT NULL,
  p_usuario           uuid        DEFAULT NULL,
  p_desde             timestamptz DEFAULT NULL,
  p_hasta             timestamptz DEFAULT NULL,
  p_limit             integer     DEFAULT 50,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id         uuid        DEFAULT NULL
)
RETURNS TABLE (
  id                uuid,
  cedulario_id      uuid,
  tabla             text,
  registro_id       uuid,
  registro_etiqueta text,
  campo             text,
  valor_anterior    jsonb,
  valor_nuevo       jsonb,
  usuario_id        uuid,
  metadata          jsonb,
  created_at        timestamptz,
  usuario_nombre    text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol    text;
  v_limite integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  v_rol := public.get_user_rol()::text;

  IF v_rol IS NULL OR v_rol NOT IN ('admin', 'profesor') THEN
    RETURN;
  END IF;

  IF v_rol <> 'admin' AND NOT EXISTS (
    SELECT 1
    FROM public.cedularios c
    WHERE c.id = p_cedulario_id
      AND c.activo
  ) THEN
    RETURN;
  END IF;

  v_limite := CASE
    WHEN p_limit IS NULL OR p_limit < 1 THEN 50
    ELSE least(p_limit, 100)
  END;

  RETURN QUERY
  SELECT h.id,
         h.cedulario_id,
         h.tabla,
         h.registro_id,
         h.registro_etiqueta,
         h.campo,
         h.valor_anterior,
         h.valor_nuevo,
         h.usuario_id,
         h.metadata,
         h.created_at,
         NULLIF(btrim(COALESCE(p.nombre, '') || ' ' || COALESCE(p.apellido, '')), '')
  FROM public.historial_cambios h
  LEFT JOIN public.profiles p ON p.id = h.usuario_id
  WHERE h.cedulario_id = p_cedulario_id
    AND NOT (h.tabla = ANY (public.seguimiento_tablas()))
    AND (p_tabla   IS NULL OR h.tabla = p_tabla)
    AND (p_usuario IS NULL OR h.usuario_id = p_usuario)
    AND (p_desde   IS NULL OR h.created_at >= p_desde)
    AND (p_hasta   IS NULL OR h.created_at <= p_hasta)
    AND (
      p_cursor_created_at IS NULL
      OR (p_cursor_id IS NULL AND h.created_at < p_cursor_created_at)
      OR (p_cursor_id IS NOT NULL AND (h.created_at, h.id) < (p_cursor_created_at, p_cursor_id))
    )
  ORDER BY h.created_at DESC, h.id DESC
  LIMIT v_limite;
END;
$$;

REVOKE ALL ON FUNCTION public.get_historial_cedulario(uuid, text, uuid, timestamptz, timestamptz, integer, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_historial_cedulario(uuid, text, uuid, timestamptz, timestamptz, integer, timestamptz, uuid) TO authenticated;

-- =============================================================================
-- END OF SECTION 8 (REDEFINITIONS OF PHASE 1 FUNCTIONS)
-- =============================================================================

-- =============================================================================
-- SECTION 9: REALTIME PUBLICATION AND ERROR CODE NOTES
--
-- The five tracking tables are added to the supabase_realtime publication,
-- each one guarded by a check on pg_publication_tables (same pattern as
-- migration 152), so the section can be applied again without errors.
--
-- REPLICA IDENTITY FULL is NOT set on any of these tables. Realtime does not
-- apply RLS to DELETE events, and with REPLICA IDENTITY FULL the DELETE event
-- carries the complete old row. On materia_progreso_comentarios (comment text)
-- and materia_progreso_repasos (review note) that would leak deleted text to
-- every subscriber of the channel. With the default identity a DELETE event
-- carries only the primary key (id), which exposes no data. Clients treat a
-- DELETE as an invalidation signal only and refetch through RLS.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'cedulario_asignaciones'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cedulario_asignaciones;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'materia_progreso'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.materia_progreso;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'materia_progreso_repasos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.materia_progreso_repasos;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'materia_progreso_comentarios'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.materia_progreso_comentarios;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'materia_progreso_clases'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.materia_progreso_clases;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Error codes of the tracking feature (CD001 to CD009 belong to Phase 1 and are
-- not reused). The server actions map each SQLSTATE to an application error.
--
--   SQLSTATE  application code           when it is raised
--   --------  -------------------------  ------------------------------------
--   CD010     asignacion_duplicada       an active assignment of the
--                                        (cedulario, alumno) pair already exists
--   CD011     alumno_no_valido           the target user is not an active
--                                        alumno; a write on an inactive alumno
--                                        by a non admin user
--   CD012     asignacion_inactiva        write on an assignment whose estado is
--                                        desasignada
--   CD013     clase_otro_alumno          the class does not belong to the alumno
--                                        of the assignment
--   CD014     materia_invalida           materia outside the cedulario, inactive,
--                                        archived, or not part of the assignment
--   CD015     fecha_futura               date later than today in the platform
--                                        timezone (America/Santiago)
--   CD016     cedulario_no_disponible    cedulario does not exist, is inactive
--                                        or is not visible to the caller
--
-- Also related (not new codes):
--   23505 with constraint uq_cedulario_asignaciones: race between two
--         simultaneous assignments of the same pair (asignacion_duplicada).
--   23514 and 42501: immutable key changed, limits exceeded, missing permission.
--
-- Rule for future changes: no SELECT policy for staff (admin, profesor) may
-- depend on a mutable column of the row. Staff SELECT policies depend only on
-- the role. Realtime evaluates the policy against the new row only, so a policy
-- that reads a mutable column (estado, asignada, ...) would hide the very UPDATE
-- that changes it from the subscribers who still need to see it.
-- ---------------------------------------------------------------------------

-- =============================================================================
-- END OF SECTION 9 (REALTIME PUBLICATION AND ERROR CODE NOTES)
-- END OF 154_seguimiento_cedularios_alumno.sql
-- =============================================================================
