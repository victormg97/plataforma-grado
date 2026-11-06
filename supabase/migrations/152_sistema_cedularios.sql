-- 152: Sistema de Cedularios (Phase 1)
--
-- Single idempotent migration. Sections, in order:
--   1. Tables, constraints, indexes and updated_at triggers
--   2. SECURITY DEFINER helper functions
--   3. Guard trigger functions and triggers
--   4. Audit trigger function and triggers
--   5. Row Level Security
--   6. RPC functions
--   7. Storage bucket, Realtime publication and Phase 2 notes
--
-- Every statement is re-runnable (IF NOT EXISTS, DROP ... IF EXISTS,
-- CREATE OR REPLACE, guarded inserts) so each tenant database can apply it
-- independently.

-- =============================================================================
-- SECTION 1: TABLES, CONSTRAINTS, INDEXES AND updated_at TRIGGERS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- universidades
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.universidades (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL CHECK (char_length(btrim(nombre)) BETWEEN 1 AND 120),
  codigo      text NOT NULL CHECK (char_length(btrim(codigo)) BETWEEN 1 AND 20),
  logo_url    text,
  activo      boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Codigo is unique after trim + upper case, including inactive universidades.
CREATE UNIQUE INDEX IF NOT EXISTS uq_universidades_codigo
  ON public.universidades (upper(btrim(codigo)));
CREATE INDEX IF NOT EXISTS idx_universidades_created_by ON public.universidades (created_by);
CREATE INDEX IF NOT EXISTS idx_universidades_updated_by ON public.universidades (updated_by);

-- ---------------------------------------------------------------------------
-- cedularios
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cedularios (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  universidad_id uuid NOT NULL REFERENCES public.universidades(id) ON DELETE RESTRICT,
  nombre         text NOT NULL CHECK (char_length(btrim(nombre)) BETWEEN 1 AND 200),
  version        text CHECK (version IS NULL OR char_length(version) <= 50),
  descripcion    text CHECK (descripcion IS NULL OR char_length(descripcion) <= 2000),
  normativa      jsonb CHECK (normativa IS NULL OR octet_length(normativa::text) <= 200000),
  rubrica        jsonb CHECK (rubrica   IS NULL OR octet_length(rubrica::text)   <= 200000),
  activo         boolean NOT NULL DEFAULT true,
  created_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cedularios_universidad ON public.cedularios (universidad_id);
CREATE INDEX IF NOT EXISTS idx_cedularios_created_by  ON public.cedularios (created_by);
CREATE INDEX IF NOT EXISTS idx_cedularios_updated_by  ON public.cedularios (updated_by);

-- ---------------------------------------------------------------------------
-- cedulario_enlaces
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cedulario_enlaces (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cedulario_id uuid NOT NULL REFERENCES public.cedularios(id) ON DELETE CASCADE,
  url          text NOT NULL CHECK (url ~* '^https?://' AND char_length(url) <= 2048),
  titulo       text NOT NULL CHECK (char_length(btrim(titulo)) BETWEEN 1 AND 200),
  descripcion  text CHECK (descripcion IS NULL OR char_length(descripcion) <= 500),
  orden        integer NOT NULL DEFAULT 0,   -- 0 = "append"; replaced by a trigger
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cedulario_enlaces_cedulario
  ON public.cedulario_enlaces (cedulario_id, orden);

-- ---------------------------------------------------------------------------
-- materias
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.materias (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cedulario_id  uuid NOT NULL REFERENCES public.cedularios(id) ON DELETE CASCADE,
  parent_id     uuid REFERENCES public.materias(id) ON DELETE CASCADE,
  codigo        text NOT NULL CHECK (char_length(btrim(codigo)) BETWEEN 1 AND 30),
  nombre        text NOT NULL CHECK (char_length(btrim(nombre)) BETWEEN 1 AND 300),
  descripcion   text CHECK (descripcion IS NULL OR char_length(descripcion) <= 2000),
  temario       jsonb CHECK (temario IS NULL OR octet_length(temario::text) <= 200000),
  temario_texto text,                                  -- plain text of temario, maintained by trigger
  orden         integer NOT NULL DEFAULT 0,            -- 0 = "append"; real values are multiples of 1024 or midpoints
  nivel         smallint NOT NULL DEFAULT 1 CHECK (nivel BETWEEN 1 AND 5),  -- derived by trigger, never client-set
  activo        boolean NOT NULL DEFAULT true,
  updated_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Codigo is unique among ACTIVE siblings (same cedulario and same parent; roots
-- of one cedulario are siblings of each other), trimmed and case-insensitive.
CREATE UNIQUE INDEX IF NOT EXISTS uq_materias_codigo_hermanos
  ON public.materias (
    cedulario_id,
    COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(btrim(codigo))
  )
  WHERE activo;

-- Tree traversal (children of a node, ordered) and parent lookups.
CREATE INDEX IF NOT EXISTS idx_materias_hijos
  ON public.materias (cedulario_id, parent_id, orden) WHERE activo;
CREATE INDEX IF NOT EXISTS idx_materias_parent
  ON public.materias (parent_id);
-- idx_materias_hijos is partial (activo only), so this plain index serves the
-- cedulario_id foreign key for inactive rows too (cascade deletes, restores).
CREATE INDEX IF NOT EXISTS idx_materias_cedulario
  ON public.materias (cedulario_id);
CREATE INDEX IF NOT EXISTS idx_materias_updated_by
  ON public.materias (updated_by);

-- ---------------------------------------------------------------------------
-- materia_enlaces
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.materia_enlaces (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  materia_id   uuid NOT NULL REFERENCES public.materias(id) ON DELETE CASCADE,
  cedulario_id uuid NOT NULL,                          -- denormalized by trigger (Realtime filter, audit, RLS)
  url          text NOT NULL CHECK (url ~* '^https?://' AND char_length(url) <= 2048),
  titulo       text NOT NULL CHECK (char_length(btrim(titulo)) BETWEEN 1 AND 200),
  descripcion  text CHECK (descripcion IS NULL OR char_length(descripcion) <= 500),
  orden        integer NOT NULL DEFAULT 0,             -- 0 = "append"; replaced by a trigger
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_materia_enlaces_materia
  ON public.materia_enlaces (materia_id, orden);
CREATE INDEX IF NOT EXISTS idx_materia_enlaces_cedulario
  ON public.materia_enlaces (cedulario_id);

-- ---------------------------------------------------------------------------
-- cedulario_profesores (no updated_at: rows are only granted or revoked)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cedulario_profesores (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cedulario_id uuid NOT NULL REFERENCES public.cedularios(id) ON DELETE CASCADE,
  profesor_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,  -- forced to auth.uid() by trigger
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_cedulario_profesores UNIQUE (cedulario_id, profesor_id)
);

-- cedulario_id is covered by the leading column of uq_cedulario_profesores.
CREATE INDEX IF NOT EXISTS idx_cedulario_profesores_profesor
  ON public.cedulario_profesores (profesor_id);
CREATE INDEX IF NOT EXISTS idx_cedulario_profesores_granted_by
  ON public.cedulario_profesores (granted_by);

-- ---------------------------------------------------------------------------
-- historial_cambios (no updated_at; no FK on cedulario_id so history survives purges)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.historial_cambios (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cedulario_id      uuid,                 -- NULL for universidad rows; intentionally no FK
  tabla             text NOT NULL,        -- free text so Phase 2 tables can log here
  registro_id       uuid NOT NULL,
  registro_etiqueta text,                 -- label at event time (nombre / titulo / profesor name)
  campo             text NOT NULL,        -- column name, or 'created' / 'deleted'
  valor_anterior    jsonb,
  valor_nuevo       jsonb,
  usuario_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata          jsonb,                -- reserved for Phase 2 (assignment / progress events)
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historial_cedulario
  ON public.historial_cambios (cedulario_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_historial_registro
  ON public.historial_cambios (tabla, registro_id, created_at DESC);
-- Also serves the usuario_id foreign key.
CREATE INDEX IF NOT EXISTS idx_historial_usuario
  ON public.historial_cambios (usuario_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- updated_at triggers (update_updated_at() comes from migration 001).
-- Not on cedulario_profesores or historial_cambios: they have no updated_at.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS universidades_updated_at ON public.universidades;
CREATE TRIGGER universidades_updated_at
  BEFORE UPDATE ON public.universidades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS cedularios_updated_at ON public.cedularios;
CREATE TRIGGER cedularios_updated_at
  BEFORE UPDATE ON public.cedularios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS cedulario_enlaces_updated_at ON public.cedulario_enlaces;
CREATE TRIGGER cedulario_enlaces_updated_at
  BEFORE UPDATE ON public.cedulario_enlaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS materias_updated_at ON public.materias;
CREATE TRIGGER materias_updated_at
  BEFORE UPDATE ON public.materias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS materia_enlaces_updated_at ON public.materia_enlaces;
CREATE TRIGGER materia_enlaces_updated_at
  BEFORE UPDATE ON public.materia_enlaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================================================
-- END OF SECTION 1: TABLES, CONSTRAINTS, INDEXES AND updated_at TRIGGERS
-- =============================================================================

-- =============================================================================
-- SECTION 2: SECURITY DEFINER HELPER FUNCTIONS
-- =============================================================================
-- All permission checks used by RLS policies and guard triggers go through
-- these functions. They are SECURITY DEFINER so they can read cedularios,
-- cedulario_profesores and materias without re-entering RLS (avoids the
-- recursion fixed in migration 016). get_user_rol() comes from migration 001.
-- Each function is STABLE, pins search_path, and is executable by
-- authenticated users only.
--
-- Supabase grants EXECUTE on new public functions to anon and authenticated
-- through default privileges, and REVOKE ... FROM PUBLIC does not remove those
-- explicit grants. Every REVOKE in this file therefore also names anon, and
-- the trigger-only functions (sections 3 and 4) are revoked from authenticated
-- too: a trigger fires without the EXECUTE privilege, so nobody needs it.

-- ---------------------------------------------------------------------------
-- cedulario_es_creador: caller created the cedulario (created_by = auth.uid())
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cedulario_es_creador(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cedularios c
    WHERE c.id = p_id
      AND c.created_by = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.cedulario_es_creador(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cedulario_es_creador(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- cedulario_es_colaborador: caller has a row in cedulario_profesores
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cedulario_es_colaborador(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cedulario_profesores cp
    WHERE cp.cedulario_id = p_id
      AND cp.profesor_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.cedulario_es_colaborador(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cedulario_es_colaborador(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- cedulario_puede_editar: admin, or profesor who is creator or collaborator
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cedulario_puede_editar(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    public.get_user_rol() = 'admin'
    OR (
      public.get_user_rol() = 'profesor'
      AND (
        public.cedulario_es_creador(p_id)
        OR public.cedulario_es_colaborador(p_id)
      )
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.cedulario_puede_editar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cedulario_puede_editar(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- cedulario_puede_gestionar: admin, or profesor who is the creator
-- (activo / universidad_id changes and collaborator management)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cedulario_puede_gestionar(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    public.get_user_rol() = 'admin'
    OR (
      public.get_user_rol() = 'profesor'
      AND public.cedulario_es_creador(p_id)
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.cedulario_puede_gestionar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cedulario_puede_gestionar(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- materia_puede_editar: resolves the materia's cedulario, then
-- cedulario_puede_editar. Returns false when the materia does not exist.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.materia_puede_editar(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT public.cedulario_puede_editar(m.cedulario_id)
      FROM public.materias m
      WHERE m.id = p_id
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.materia_puede_editar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.materia_puede_editar(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- cedulario_tiene_asignaciones: Phase 1 stub, always false.
-- Phase 2 replaces it with CREATE OR REPLACE once assignments exist.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cedulario_tiene_asignaciones(p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT false;
$$;

REVOKE ALL ON FUNCTION public.cedulario_tiene_asignaciones(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cedulario_tiene_asignaciones(uuid) TO authenticated;

-- =============================================================================
-- END OF SECTION 2: SECURITY DEFINER HELPER FUNCTIONS
-- =============================================================================

-- =============================================================================
-- SECTION 3: GUARD TRIGGER FUNCTIONS AND TRIGGERS
-- =============================================================================
-- Tree integrity, ownership rules and derived columns are enforced here, so
-- they hold for every writer (Server Actions, RPCs, SQL editor).
--
-- Business errors use custom SQLSTATEs of class CD (5 characters, digits and
-- upper case letters, outside the classes Postgres defines). The app maps them
-- in lib/cedularios/errors.ts (mapDbError):
--   CD001 maximum depth (5 levels) exceeded
--   CD002 move would create a cycle
--   CD003 parent is missing, inactive or belongs to another cedulario
--   CD004 universidad still has an active cedulario
--   CD005 collaborator is not a profesor
--   CD006 collaborator is the creator of the cedulario
--   CD007 only the creator or an admin may change activo / universidad_id
--   CD008 cedulario has assignments and cannot be deactivated
--   (CD009 is raised by the reorder RPCs in section 6)
-- Immutable columns raise 23514 (validation) or 42501 (no permission).
--
-- All guard functions are SECURITY DEFINER with a pinned search_path: they
-- must read rows the caller cannot see through RLS (inactive materias, the
-- whole subtree below a moved materia) and call the section 2 helpers from
-- any database role. auth.uid() is read from the request JWT settings, so it
-- is not affected by SECURITY DEFINER. Trigger functions are not callable as
-- RPCs; EXECUTE is revoked from PUBLIC anyway.
--
-- pg_trigger_depth() > 1 together with a column going from a value to NULL
-- identifies the ON DELETE SET NULL action of a foreign key (for example a
-- deleted profile). Those updates must pass untouched, otherwise deleting a
-- profile would be blocked by the immutability rules below.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- materias_guard: BEFORE INSERT OR UPDATE ON materias (row level)
--   - serializes structural changes per cedulario (advisory lock)
--   - cedulario_id is immutable
--   - derives nivel from the parent (never client-set)
--   - rejects cycles (CD002), depth > 5 including the moved subtree (CD001)
--     and missing / inactive / foreign parents (CD003)
--   - appends orden on insert when orden = 0
--   - maintains temario_texto and updated_by
-- Order of checks on a move mirrors lib/cedularios/tree.ts: cycle, parent,
-- depth.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.materias_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent         public.materias%ROWTYPE;
  v_parent_cambia  boolean;
  v_estructural    boolean;
  v_validar_padre  boolean;
  v_altura_desc    integer;
  v_temario_cambia boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- ON DELETE SET NULL of updated_by (profile deleted): nothing to guard.
    IF pg_trigger_depth() > 1
       AND OLD.updated_by IS NOT NULL
       AND NEW.updated_by IS NULL THEN
      RETURN NEW;
    END IF;

    IF NEW.cedulario_id IS DISTINCT FROM OLD.cedulario_id THEN
      RAISE EXCEPTION 'cedularios.cedulario_inmutable' USING ERRCODE = '23514';
    END IF;
  END IF;

  -- What changed (OLD does not exist on INSERT, so no short-circuit reliance).
  IF TG_OP = 'INSERT' THEN
    v_parent_cambia := false;
    v_estructural   := true;
    v_validar_padre := true;
  ELSE
    v_parent_cambia := NEW.parent_id IS DISTINCT FROM OLD.parent_id;
    v_estructural   := v_parent_cambia OR NEW.activo IS DISTINCT FROM OLD.activo;
    -- The parent must be active when the row is inserted, moved or reactivated.
    -- A plain nivel propagation (re-fired by the parent) must not re-check it.
    v_validar_padre := v_parent_cambia OR (NEW.activo AND NOT OLD.activo);
  END IF;

  -- One structural change per cedulario at a time: two concurrent moves cannot
  -- create a cycle or exceed the depth limit together.
  IF v_estructural THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.cedulario_id::text));
  END IF;

  -- Cycles first (CD002): the new parent is the row itself or one of its
  -- descendants, that is, NEW.id is in the ancestor chain of the new parent.
  IF v_parent_cambia AND NEW.parent_id IS NOT NULL THEN
    IF NEW.parent_id = NEW.id THEN
      RAISE EXCEPTION 'cedularios.ciclo' USING ERRCODE = 'CD002';
    END IF;

    IF EXISTS (
      WITH RECURSIVE ancestros(id, parent_id) AS (
        SELECT m.id, m.parent_id
        FROM public.materias m
        WHERE m.id = NEW.parent_id
        UNION
        SELECT m.id, m.parent_id
        FROM public.materias m
        JOIN ancestros a ON m.id = a.parent_id
      )
      SELECT 1 FROM ancestros WHERE id = NEW.id
    ) THEN
      RAISE EXCEPTION 'cedularios.ciclo' USING ERRCODE = 'CD002';
    END IF;
  END IF;

  -- Parent and nivel.
  IF NEW.parent_id IS NULL THEN
    NEW.nivel := 1;
  ELSE
    SELECT * INTO v_parent FROM public.materias WHERE id = NEW.parent_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'cedularios.padre_invalido' USING ERRCODE = 'CD003';
    END IF;
    IF v_parent.cedulario_id IS DISTINCT FROM NEW.cedulario_id THEN
      RAISE EXCEPTION 'cedularios.padre_invalido' USING ERRCODE = 'CD003';
    END IF;
    IF v_validar_padre AND NOT v_parent.activo THEN
      RAISE EXCEPTION 'cedularios.padre_invalido' USING ERRCODE = 'CD003';
    END IF;

    NEW.nivel := v_parent.nivel + 1;
    IF NEW.nivel > 5 THEN
      RAISE EXCEPTION 'cedularios.nivel_maximo' USING ERRCODE = 'CD001';
    END IF;
  END IF;

  -- Depth of the moved subtree. Counts ALL descendants, active or not, like
  -- alturaSubarbol in lib/cedularios/tree.ts.
  IF v_parent_cambia THEN
    WITH RECURSIVE subarbol(id, h) AS (
      SELECT m.id, 1
      FROM public.materias m
      WHERE m.parent_id = NEW.id
      UNION ALL
      SELECT m.id, s.h + 1
      FROM public.materias m
      JOIN subarbol s ON m.parent_id = s.id
    )
    SELECT COALESCE(max(h), 0) INTO v_altura_desc FROM subarbol;

    -- nivel + height - 1 > 5, with height = 1 + deepest descendant offset.
    IF NEW.nivel + v_altura_desc > 5 THEN
      RAISE EXCEPTION 'cedularios.nivel_maximo' USING ERRCODE = 'CD001';
    END IF;
  END IF;

  -- Append position: orden = 0 means "last among the active siblings".
  IF TG_OP = 'INSERT' AND NEW.orden = 0 THEN
    IF NEW.parent_id IS NULL THEN
      SELECT COALESCE(max(m.orden), 0) + 1024 INTO NEW.orden
      FROM public.materias m
      WHERE m.cedulario_id = NEW.cedulario_id
        AND m.parent_id IS NULL
        AND m.activo;
    ELSE
      SELECT COALESCE(max(m.orden), 0) + 1024 INTO NEW.orden
      FROM public.materias m
      WHERE m.cedulario_id = NEW.cedulario_id
        AND m.parent_id = NEW.parent_id
        AND m.activo;
    END IF;
  END IF;

  -- temario_texto is derived: plain text of every "text" node of the document.
  IF TG_OP = 'INSERT' THEN
    v_temario_cambia := true;
  ELSE
    v_temario_cambia := NEW.temario IS DISTINCT FROM OLD.temario;
  END IF;

  IF v_temario_cambia THEN
    IF NEW.temario IS NULL THEN
      NEW.temario_texto := NULL;
    ELSE
      SELECT COALESCE(string_agg(t.v #>> '{}', ' '), '')
      INTO NEW.temario_texto
      FROM jsonb_path_query(NEW.temario, 'strict $.**.text') AS t(v)
      WHERE jsonb_typeof(t.v) = 'string';
    END IF;
  ELSE
    NEW.temario_texto := OLD.temario_texto;
  END IF;

  NEW.updated_by := auth.uid();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.materias_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS materias_guard ON public.materias;
CREATE TRIGGER materias_guard
  BEFORE INSERT OR UPDATE ON public.materias
  FOR EACH ROW EXECUTE FUNCTION public.materias_guard();

-- ---------------------------------------------------------------------------
-- materias_propagar_nivel: AFTER UPDATE when nivel changed.
-- Touching parent_id of every child (active or not) re-fires materias_guard on
-- it, which recomputes its nivel from the parent; the child's own nivel change
-- fires this trigger again, so the whole subtree stays derived. The guard does
-- not re-check "parent must be active" here because parent_id and activo do
-- not change.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.materias_propagar_nivel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.materias
  SET parent_id = parent_id
  WHERE parent_id = NEW.id;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.materias_propagar_nivel() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS materias_propagar_nivel ON public.materias;
CREATE TRIGGER materias_propagar_nivel
  AFTER UPDATE ON public.materias
  FOR EACH ROW
  WHEN (OLD.nivel IS DISTINCT FROM NEW.nivel)
  EXECUTE FUNCTION public.materias_propagar_nivel();

-- ---------------------------------------------------------------------------
-- cedularios_guard: BEFORE INSERT OR UPDATE ON cedularios
--   INSERT: created_by is forced to the caller (when there is one).
--   UPDATE: created_by is immutable; changing activo or universidad_id needs
--           cedulario_puede_gestionar (CD007); deactivating also needs no
--           assignments (CD008).
-- Calls without a JWT user (service role, SQL editor, tenant scripts) skip the
-- CD007 permission check: they are trusted server contexts, and API users
-- always carry auth.uid().
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cedularios_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.created_by := auth.uid();
    END IF;
    NEW.updated_by := auth.uid();
    RETURN NEW;
  END IF;

  -- ON DELETE SET NULL of created_by / updated_by (profile deleted).
  IF pg_trigger_depth() > 1
     AND ((OLD.created_by IS NOT NULL AND NEW.created_by IS NULL)
          OR (OLD.updated_by IS NOT NULL AND NEW.updated_by IS NULL)) THEN
    RETURN NEW;
  END IF;

  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'cedularios.created_by_inmutable' USING ERRCODE = '42501';
  END IF;

  IF NEW.activo IS DISTINCT FROM OLD.activo
     OR NEW.universidad_id IS DISTINCT FROM OLD.universidad_id THEN
    IF auth.uid() IS NOT NULL AND NOT public.cedulario_puede_gestionar(OLD.id) THEN
      RAISE EXCEPTION 'cedularios.solo_creador_o_admin' USING ERRCODE = 'CD007';
    END IF;
  END IF;

  IF OLD.activo AND NOT NEW.activo THEN
    IF public.cedulario_tiene_asignaciones(OLD.id) THEN
      RAISE EXCEPTION 'cedularios.cedulario_con_asignaciones' USING ERRCODE = 'CD008';
    END IF;
  END IF;

  NEW.updated_by := auth.uid();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.cedularios_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS cedularios_guard ON public.cedularios;
CREATE TRIGGER cedularios_guard
  BEFORE INSERT OR UPDATE ON public.cedularios
  FOR EACH ROW EXECUTE FUNCTION public.cedularios_guard();

-- ---------------------------------------------------------------------------
-- universidades_guard: BEFORE INSERT OR UPDATE ON universidades
--   INSERT: created_by is forced to the caller (when there is one).
--   UPDATE: created_by is immutable; deactivating is rejected while the
--           universidad still has an ACTIVE cedulario (CD004).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.universidades_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.created_by := auth.uid();
    END IF;
    NEW.updated_by := auth.uid();
    RETURN NEW;
  END IF;

  -- ON DELETE SET NULL of created_by / updated_by (profile deleted).
  IF pg_trigger_depth() > 1
     AND ((OLD.created_by IS NOT NULL AND NEW.created_by IS NULL)
          OR (OLD.updated_by IS NOT NULL AND NEW.updated_by IS NULL)) THEN
    RETURN NEW;
  END IF;

  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'cedularios.created_by_inmutable' USING ERRCODE = '42501';
  END IF;

  IF OLD.activo AND NOT NEW.activo THEN
    IF EXISTS (
      SELECT 1
      FROM public.cedularios c
      WHERE c.universidad_id = OLD.id
        AND c.activo
    ) THEN
      RAISE EXCEPTION 'cedularios.universidad_con_cedularios' USING ERRCODE = 'CD004';
    END IF;
  END IF;

  NEW.updated_by := auth.uid();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.universidades_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS universidades_guard ON public.universidades;
CREATE TRIGGER universidades_guard
  BEFORE INSERT OR UPDATE ON public.universidades
  FOR EACH ROW EXECUTE FUNCTION public.universidades_guard();

-- ---------------------------------------------------------------------------
-- cedulario_profesores_guard: BEFORE INSERT ON cedulario_profesores
--   granted_by is forced to the caller; the collaborator must be a profesor
--   (CD005) and must not be the creator of the cedulario (CD006).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cedulario_profesores_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol        text;
  v_created_by uuid;
BEGIN
  NEW.granted_by := auth.uid();

  SELECT p.rol::text INTO v_rol
  FROM public.profiles p
  WHERE p.id = NEW.profesor_id;

  IF v_rol IS DISTINCT FROM 'profesor' THEN
    RAISE EXCEPTION 'cedularios.colaborador_no_profesor' USING ERRCODE = 'CD005';
  END IF;

  SELECT c.created_by INTO v_created_by
  FROM public.cedularios c
  WHERE c.id = NEW.cedulario_id;

  IF v_created_by IS NOT NULL AND v_created_by = NEW.profesor_id THEN
    RAISE EXCEPTION 'cedularios.colaborador_es_creador' USING ERRCODE = 'CD006';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.cedulario_profesores_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS cedulario_profesores_guard ON public.cedulario_profesores;
CREATE TRIGGER cedulario_profesores_guard
  BEFORE INSERT ON public.cedulario_profesores
  FOR EACH ROW EXECUTE FUNCTION public.cedulario_profesores_guard();

-- ---------------------------------------------------------------------------
-- materia_enlaces_guard: BEFORE INSERT OR UPDATE ON materia_enlaces
--   cedulario_id is denormalized from the materia, materia_id is immutable,
--   and orden = 0 on insert appends after the last link of the materia.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.materia_enlaces_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cedulario_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT m.cedulario_id INTO v_cedulario_id
    FROM public.materias m
    WHERE m.id = NEW.materia_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'cedularios.materia_no_existe' USING ERRCODE = '23503';
    END IF;

    NEW.cedulario_id := v_cedulario_id;

    IF NEW.orden = 0 THEN
      SELECT COALESCE(max(e.orden), 0) + 1024 INTO NEW.orden
      FROM public.materia_enlaces e
      WHERE e.materia_id = NEW.materia_id;
    END IF;
  ELSE
    IF NEW.materia_id IS DISTINCT FROM OLD.materia_id THEN
      RAISE EXCEPTION 'cedularios.materia_id_inmutable' USING ERRCODE = '23514';
    END IF;

    -- The materia never changes cedulario, so the denormalized value is fixed.
    NEW.cedulario_id := OLD.cedulario_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.materia_enlaces_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS materia_enlaces_guard ON public.materia_enlaces;
CREATE TRIGGER materia_enlaces_guard
  BEFORE INSERT OR UPDATE ON public.materia_enlaces
  FOR EACH ROW EXECUTE FUNCTION public.materia_enlaces_guard();

-- ---------------------------------------------------------------------------
-- cedulario_enlaces_guard: BEFORE INSERT OR UPDATE ON cedulario_enlaces
--   cedulario_id is immutable; orden = 0 on insert appends after the last link.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cedulario_enlaces_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.orden = 0 THEN
      SELECT COALESCE(max(e.orden), 0) + 1024 INTO NEW.orden
      FROM public.cedulario_enlaces e
      WHERE e.cedulario_id = NEW.cedulario_id;
    END IF;
  ELSE
    IF NEW.cedulario_id IS DISTINCT FROM OLD.cedulario_id THEN
      RAISE EXCEPTION 'cedularios.cedulario_inmutable' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.cedulario_enlaces_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS cedulario_enlaces_guard ON public.cedulario_enlaces;
CREATE TRIGGER cedulario_enlaces_guard
  BEFORE INSERT OR UPDATE ON public.cedulario_enlaces
  FOR EACH ROW EXECUTE FUNCTION public.cedulario_enlaces_guard();

-- =============================================================================
-- END OF SECTION 3: GUARD TRIGGER FUNCTIONS AND TRIGGERS
-- =============================================================================

-- =============================================================================
-- SECTION 4: AUDIT TRIGGER FUNCTION AND TRIGGERS
-- =============================================================================
-- cedularios_audit() is the only writer of historial_cambios (clients get no
-- INSERT / UPDATE / DELETE policy in section 5). It runs AFTER each row change,
-- inside the transaction of the change it describes, so history and data
-- commit or roll back together.
--
--   INSERT  one row: campo 'created', valor_nuevo {"id", "etiqueta"}
--   DELETE  one row: campo 'deleted', valor_anterior {"id", "etiqueta"}
--   UPDATE  one row per column whose value actually changed (to_jsonb(OLD)
--           compared with to_jsonb(NEW)), except the ignored columns:
--             - always: updated_at, updated_by, nivel, temario_texto
--             - materia_enlaces: cedulario_id (denormalized copy)
--             - cedulario_enlaces and materia_enlaces: orden
--             - materias: orden while the transaction setting
--               cedularios.suprimir_orden is 'on' (mover_materia sets it
--               locally only while it renumbers siblings OTHER than the moved
--               row, so the moved row's own orden change is still recorded)
--
-- Label (registro_etiqueta): nombre for universidades, cedularios and
-- materias; titulo for both enlaces tables; "nombre apellido" of the affected
-- profesor for cedulario_profesores. Label lookups tolerate missing rows
-- (cascaded deletes, deleted profiles), in which case the label is NULL.
--
-- Coalescing (decision D-4): for normativa, rubrica and temario, when the
-- latest row for the same (tabla, registro_id, campo) has the same usuario_id
-- (NULL and NULL count as the same) and is less than 10 minutes old, that row
-- is updated (valor_nuevo and created_at only, valor_anterior is kept) instead
-- of inserting a new one.
--
-- historial_cambios.cedulario_id has no foreign key, so rows written while a
-- cedulario is being deleted (cascade) are valid. usuario_id is auth.uid(), or
-- NULL for service role / SQL editor calls and for users without a profile row.
--
-- SECURITY DEFINER with a pinned search_path so the function can write to
-- historial_cambios regardless of the caller's RLS. JSON null is stored as SQL
-- NULL in valor_anterior / valor_nuevo ("empty").
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cedularios_audit()
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
  v_cedulario_id uuid;
  v_etiqueta     text;
  v_usuario_id   uuid;
  v_suprimir     boolean;
  v_campo        text;
  v_valor_ant    jsonb;
  v_valor_nuevo  jsonb;
  v_ultimo       public.historial_cambios%ROWTYPE;
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

  -- Owning cedulario (NULL for universidades).
  IF TG_TABLE_NAME = 'universidades' THEN
    v_cedulario_id := NULL;
  ELSIF TG_TABLE_NAME = 'cedularios' THEN
    v_cedulario_id := v_registro_id;
  ELSE
    v_cedulario_id := (v_row ->> 'cedulario_id')::uuid;
  END IF;

  -- Human label at event time.
  IF TG_TABLE_NAME IN ('universidades', 'cedularios', 'materias') THEN
    v_etiqueta := v_row ->> 'nombre';
  ELSIF TG_TABLE_NAME IN ('cedulario_enlaces', 'materia_enlaces') THEN
    v_etiqueta := v_row ->> 'titulo';
  ELSIF TG_TABLE_NAME = 'cedulario_profesores' THEN
    SELECT NULLIF(btrim(COALESCE(p.nombre, '') || ' ' || COALESCE(p.apellido, '')), '')
    INTO v_etiqueta
    FROM public.profiles p
    WHERE p.id = (v_row ->> 'profesor_id')::uuid;
  END IF;

  -- Acting user; only profiles can be referenced by historial_cambios.usuario_id.
  SELECT p.id INTO v_usuario_id
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.historial_cambios (
      cedulario_id, tabla, registro_id, registro_etiqueta,
      campo, valor_anterior, valor_nuevo, usuario_id
    ) VALUES (
      v_cedulario_id, TG_TABLE_NAME, v_registro_id, v_etiqueta,
      'created', NULL,
      jsonb_build_object('id', v_registro_id, 'etiqueta', v_etiqueta),
      v_usuario_id
    );
    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.historial_cambios (
      cedulario_id, tabla, registro_id, registro_etiqueta,
      campo, valor_anterior, valor_nuevo, usuario_id
    ) VALUES (
      v_cedulario_id, TG_TABLE_NAME, v_registro_id, v_etiqueta,
      'deleted',
      jsonb_build_object('id', v_registro_id, 'etiqueta', v_etiqueta),
      NULL,
      v_usuario_id
    );
    RETURN NULL;
  END IF;

  -- UPDATE: one row per changed column.
  v_suprimir := COALESCE(current_setting('cedularios.suprimir_orden', true), '') = 'on';

  FOR v_campo IN SELECT jsonb_object_keys(v_new) LOOP
    IF v_campo IN ('updated_at', 'updated_by', 'nivel', 'temario_texto') THEN
      CONTINUE;
    END IF;
    IF v_campo = 'cedulario_id' AND TG_TABLE_NAME = 'materia_enlaces' THEN
      CONTINUE;
    END IF;
    IF v_campo = 'orden'
       AND (TG_TABLE_NAME IN ('cedulario_enlaces', 'materia_enlaces')
            OR (TG_TABLE_NAME = 'materias' AND v_suprimir)) THEN
      CONTINUE;
    END IF;

    IF (v_old -> v_campo) IS NOT DISTINCT FROM (v_new -> v_campo) THEN
      CONTINUE;
    END IF;

    v_valor_ant   := NULLIF(v_old -> v_campo, 'null'::jsonb);
    v_valor_nuevo := NULLIF(v_new -> v_campo, 'null'::jsonb);

    -- Coalesce consecutive edits of the same rich-text field by the same user.
    IF v_campo IN ('normativa', 'rubrica', 'temario') THEN
      SELECT h.* INTO v_ultimo
      FROM public.historial_cambios h
      WHERE h.tabla = TG_TABLE_NAME
        AND h.registro_id = v_registro_id
        AND h.campo = v_campo
      ORDER BY h.created_at DESC, h.id DESC
      LIMIT 1;

      IF FOUND
         AND v_ultimo.usuario_id IS NOT DISTINCT FROM v_usuario_id
         AND v_ultimo.created_at > now() - interval '10 minutes' THEN
        UPDATE public.historial_cambios
        SET valor_nuevo = v_valor_nuevo,
            created_at  = now()
        WHERE id = v_ultimo.id;
        CONTINUE;
      END IF;
    END IF;

    INSERT INTO public.historial_cambios (
      cedulario_id, tabla, registro_id, registro_etiqueta,
      campo, valor_anterior, valor_nuevo, usuario_id
    ) VALUES (
      v_cedulario_id, TG_TABLE_NAME, v_registro_id, v_etiqueta,
      v_campo, v_valor_ant, v_valor_nuevo, v_usuario_id
    );
  END LOOP;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.cedularios_audit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS universidades_audit ON public.universidades;
CREATE TRIGGER universidades_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.universidades
  FOR EACH ROW EXECUTE FUNCTION public.cedularios_audit();

DROP TRIGGER IF EXISTS cedularios_audit ON public.cedularios;
CREATE TRIGGER cedularios_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.cedularios
  FOR EACH ROW EXECUTE FUNCTION public.cedularios_audit();

DROP TRIGGER IF EXISTS cedulario_enlaces_audit ON public.cedulario_enlaces;
CREATE TRIGGER cedulario_enlaces_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.cedulario_enlaces
  FOR EACH ROW EXECUTE FUNCTION public.cedularios_audit();

DROP TRIGGER IF EXISTS materias_audit ON public.materias;
CREATE TRIGGER materias_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.materias
  FOR EACH ROW EXECUTE FUNCTION public.cedularios_audit();

DROP TRIGGER IF EXISTS materia_enlaces_audit ON public.materia_enlaces;
CREATE TRIGGER materia_enlaces_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.materia_enlaces
  FOR EACH ROW EXECUTE FUNCTION public.cedularios_audit();

DROP TRIGGER IF EXISTS cedulario_profesores_audit ON public.cedulario_profesores;
CREATE TRIGGER cedulario_profesores_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.cedulario_profesores
  FOR EACH ROW EXECUTE FUNCTION public.cedularios_audit();

-- =============================================================================
-- END OF SECTION 4: AUDIT TRIGGER FUNCTION AND TRIGGERS
-- =============================================================================

-- =============================================================================
-- SECTION 5: ROW LEVEL SECURITY
-- =============================================================================
-- RLS is enabled on all seven tables. Every policy is dropped first and then
-- created, so the section can be re-run. Policy names are in Spanish like
-- migration 007. All policies are TO authenticated: anon matches no policy and
-- is denied. Default table grants are left untouched.
--
-- Rules shared by the policies:
--   - Inactive records (activo = false) are visible to admin only. A child row
--     (enlaces, materias) is visible only while its cedulario is visible.
--   - Permission checks use get_user_rol() and the section 2 helpers
--     (cedulario_puede_editar, cedulario_puede_gestionar), all SECURITY
--     DEFINER, written as (select fn(...)) when the argument is a constant
--     (evaluated once per statement) and called directly when the argument is a
--     column of the row.
--   - No recursion: policies on materias, cedulario_enlaces and materia_enlaces
--     read cedularios (and materia_enlaces reads materias), whose policies use
--     only get_user_rol() and the helpers. cedulario_profesores policies use
--     only get_user_rol() and the helpers. No policy reads a table whose policy
--     reads it back.
--   - Creator "delete" is a soft delete (UPDATE of activo). Physical DELETE is
--     admin only on universidades, cedularios and materias.
--   - What a collaborator may change on a cedulario (nombre, version,
--     descripcion, normativa, rubrica, but not activo / universidad_id /
--     created_by) is narrowed by cedularios_guard in section 3.
--   - historial_cambios has no INSERT / UPDATE / DELETE policy: only the audit
--     trigger (SECURITY DEFINER) writes it. cedulario_profesores has no UPDATE
--     policy: records are only granted or revoked.
-- =============================================================================

ALTER TABLE public.universidades        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cedularios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cedulario_enlaces    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materias             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materia_enlaces      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cedulario_profesores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_cambios    ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- universidades
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Autenticados ven universidades activas, admin ve todas" ON public.universidades;
CREATE POLICY "Autenticados ven universidades activas, admin ve todas" ON public.universidades
  FOR SELECT TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND (activo OR (select public.get_user_rol()) = 'admin')
  );

DROP POLICY IF EXISTS "Admin y profesor crean universidades propias" ON public.universidades;
CREATE POLICY "Admin y profesor crean universidades propias" ON public.universidades
  FOR INSERT TO authenticated
  WITH CHECK (
    (select public.get_user_rol()) IN ('admin', 'profesor')
    AND created_by = (select auth.uid())
  );

DROP POLICY IF EXISTS "Admin o profesor creador actualiza universidades" ON public.universidades;
CREATE POLICY "Admin o profesor creador actualiza universidades" ON public.universidades
  FOR UPDATE TO authenticated
  USING (
    (select public.get_user_rol()) = 'admin'
    OR (
      (select public.get_user_rol()) = 'profesor'
      AND created_by = (select auth.uid())
    )
  )
  WITH CHECK (
    (select public.get_user_rol()) = 'admin'
    OR (
      (select public.get_user_rol()) = 'profesor'
      AND created_by = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Solo admin elimina universidades" ON public.universidades;
CREATE POLICY "Solo admin elimina universidades" ON public.universidades
  FOR DELETE TO authenticated
  USING ((select public.get_user_rol()) = 'admin');

-- ---------------------------------------------------------------------------
-- cedularios
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Autenticados ven cedularios activos, admin ve todos" ON public.cedularios;
CREATE POLICY "Autenticados ven cedularios activos, admin ve todos" ON public.cedularios
  FOR SELECT TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND (activo OR (select public.get_user_rol()) = 'admin')
  );

DROP POLICY IF EXISTS "Admin y profesor crean cedularios propios" ON public.cedularios;
CREATE POLICY "Admin y profesor crean cedularios propios" ON public.cedularios
  FOR INSERT TO authenticated
  WITH CHECK (
    (select public.get_user_rol()) IN ('admin', 'profesor')
    AND created_by = (select auth.uid())
  );

DROP POLICY IF EXISTS "Admin, creador y colaboradores actualizan cedularios" ON public.cedularios;
CREATE POLICY "Admin, creador y colaboradores actualizan cedularios" ON public.cedularios
  FOR UPDATE TO authenticated
  USING (public.cedulario_puede_editar(id))
  WITH CHECK (public.cedulario_puede_editar(id));

DROP POLICY IF EXISTS "Solo admin elimina cedularios" ON public.cedularios;
CREATE POLICY "Solo admin elimina cedularios" ON public.cedularios
  FOR DELETE TO authenticated
  USING ((select public.get_user_rol()) = 'admin');

-- ---------------------------------------------------------------------------
-- cedulario_enlaces
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Ven enlaces de cedularios visibles" ON public.cedulario_enlaces;
CREATE POLICY "Ven enlaces de cedularios visibles" ON public.cedulario_enlaces
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.cedularios c
      WHERE c.id = cedulario_enlaces.cedulario_id
        AND (c.activo OR (select public.get_user_rol()) = 'admin')
    )
  );

DROP POLICY IF EXISTS "Editores crean enlaces de cedulario" ON public.cedulario_enlaces;
CREATE POLICY "Editores crean enlaces de cedulario" ON public.cedulario_enlaces
  FOR INSERT TO authenticated
  WITH CHECK (public.cedulario_puede_editar(cedulario_id));

DROP POLICY IF EXISTS "Editores actualizan enlaces de cedulario" ON public.cedulario_enlaces;
CREATE POLICY "Editores actualizan enlaces de cedulario" ON public.cedulario_enlaces
  FOR UPDATE TO authenticated
  USING (public.cedulario_puede_editar(cedulario_id))
  WITH CHECK (public.cedulario_puede_editar(cedulario_id));

DROP POLICY IF EXISTS "Editores eliminan enlaces de cedulario" ON public.cedulario_enlaces;
CREATE POLICY "Editores eliminan enlaces de cedulario" ON public.cedulario_enlaces
  FOR DELETE TO authenticated
  USING (public.cedulario_puede_editar(cedulario_id));

-- ---------------------------------------------------------------------------
-- materias
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Ven materias activas de cedularios visibles, admin ve todas" ON public.materias;
CREATE POLICY "Ven materias activas de cedularios visibles, admin ve todas" ON public.materias
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.cedularios c
      WHERE c.id = materias.cedulario_id
        AND (c.activo OR (select public.get_user_rol()) = 'admin')
    )
    AND (activo OR (select public.get_user_rol()) = 'admin')
  );

DROP POLICY IF EXISTS "Editores crean materias" ON public.materias;
CREATE POLICY "Editores crean materias" ON public.materias
  FOR INSERT TO authenticated
  WITH CHECK (public.cedulario_puede_editar(cedulario_id));

DROP POLICY IF EXISTS "Editores actualizan materias" ON public.materias;
CREATE POLICY "Editores actualizan materias" ON public.materias
  FOR UPDATE TO authenticated
  USING (public.cedulario_puede_editar(cedulario_id))
  WITH CHECK (public.cedulario_puede_editar(cedulario_id));

DROP POLICY IF EXISTS "Solo admin elimina materias" ON public.materias;
CREATE POLICY "Solo admin elimina materias" ON public.materias
  FOR DELETE TO authenticated
  USING ((select public.get_user_rol()) = 'admin');

-- ---------------------------------------------------------------------------
-- materia_enlaces
-- Visible when its cedulario is visible and its materia is active; admin sees
-- the enlaces of inactive materias too. cedulario_id is the denormalized copy
-- set by materia_enlaces_guard, so it is always trustworthy in WITH CHECK.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Ven enlaces de materias visibles" ON public.materia_enlaces;
CREATE POLICY "Ven enlaces de materias visibles" ON public.materia_enlaces
  FOR SELECT TO authenticated
  USING (
    (select public.get_user_rol()) = 'admin'
    OR (
      EXISTS (
        SELECT 1
        FROM public.cedularios c
        WHERE c.id = materia_enlaces.cedulario_id
          AND c.activo
      )
      AND EXISTS (
        SELECT 1
        FROM public.materias m
        WHERE m.id = materia_enlaces.materia_id
          AND m.activo
      )
    )
  );

DROP POLICY IF EXISTS "Editores crean enlaces de materia" ON public.materia_enlaces;
CREATE POLICY "Editores crean enlaces de materia" ON public.materia_enlaces
  FOR INSERT TO authenticated
  WITH CHECK (public.cedulario_puede_editar(cedulario_id));

DROP POLICY IF EXISTS "Editores actualizan enlaces de materia" ON public.materia_enlaces;
CREATE POLICY "Editores actualizan enlaces de materia" ON public.materia_enlaces
  FOR UPDATE TO authenticated
  USING (public.cedulario_puede_editar(cedulario_id))
  WITH CHECK (public.cedulario_puede_editar(cedulario_id));

DROP POLICY IF EXISTS "Editores eliminan enlaces de materia" ON public.materia_enlaces;
CREATE POLICY "Editores eliminan enlaces de materia" ON public.materia_enlaces
  FOR DELETE TO authenticated
  USING (public.cedulario_puede_editar(cedulario_id));

-- ---------------------------------------------------------------------------
-- cedulario_profesores (no UPDATE policy: records are granted or revoked)
-- SELECT: admin sees all; profesor only the rows of ACTIVE cedularios (the
-- cedularios policies use the section 2 helpers, which read this table as
-- SECURITY DEFINER, so reading cedularios here does not recurse).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin y profesor ven colaboradores" ON public.cedulario_profesores;
CREATE POLICY "Admin y profesor ven colaboradores" ON public.cedulario_profesores
  FOR SELECT TO authenticated
  USING (
    (select public.get_user_rol()) = 'admin'
    OR (
      (select public.get_user_rol()) = 'profesor'
      AND EXISTS (
        SELECT 1
        FROM public.cedularios c
        WHERE c.id = cedulario_profesores.cedulario_id
          AND c.activo
      )
    )
  );

DROP POLICY IF EXISTS "Admin y creador agregan colaboradores" ON public.cedulario_profesores;
CREATE POLICY "Admin y creador agregan colaboradores" ON public.cedulario_profesores
  FOR INSERT TO authenticated
  WITH CHECK (public.cedulario_puede_gestionar(cedulario_id));

DROP POLICY IF EXISTS "Admin y creador quitan colaboradores" ON public.cedulario_profesores;
CREATE POLICY "Admin y creador quitan colaboradores" ON public.cedulario_profesores
  FOR DELETE TO authenticated
  USING (public.cedulario_puede_gestionar(cedulario_id));

-- ---------------------------------------------------------------------------
-- historial_cambios (read-only for clients; no INSERT / UPDATE / DELETE policy)
-- Rows with cedulario_id NULL are universidad changes. Admin sees every row,
-- including rows whose cedulario no longer exists; profesor sees universidad
-- rows and the rows of ACTIVE cedularios.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin y profesor ven historial de cedularios visibles" ON public.historial_cambios;
CREATE POLICY "Admin y profesor ven historial de cedularios visibles" ON public.historial_cambios
  FOR SELECT TO authenticated
  USING (
    (select public.get_user_rol()) = 'admin'
    OR (
      (select public.get_user_rol()) = 'profesor'
      AND (
        cedulario_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.cedularios c
          WHERE c.id = historial_cambios.cedulario_id
            AND c.activo
        )
      )
    )
  );

-- =============================================================================
-- END OF SECTION 5: ROW LEVEL SECURITY
-- =============================================================================

-- =============================================================================
-- SECTION 6: RPC FUNCTIONS
-- =============================================================================
-- Called by the Server Actions through supabase.rpc().
--
--   SECURITY INVOKER (RLS and the guard triggers apply to the caller):
--     mover_materia, desactivar_materia, reordenar_enlaces_cedulario,
--     reordenar_enlaces_materia, buscar_materias, desactivar_cedulario,
--     desactivar_universidad
--   SECURITY DEFINER (check the caller role inside, search_path = public):
--     restaurar_materias, get_historial_cedulario, listar_colaboradores,
--     listar_profesores_cedularios
--
-- Every function is revoked from PUBLIC and granted to authenticated only.
-- Error codes: 42501 no permission (zero rows updated), 23514 invalid input,
-- CD009 stale id list (reorder RPCs). Cycle, depth and parent errors
-- (CD001 to CD003) and the codigo unique violation come from the section 3
-- guard triggers and the uq_materias_codigo_hermanos index.
--
-- Soft deletes (activo = false) are done here and not with a client side
-- UPDATE ... RETURNING: for a non-admin the SELECT policies are checked against
-- the NEW (inactive) row of a RETURNING clause and would reject the update.
-- These functions never use RETURNING on the deactivated rows.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- mover_materia: moves a materia under p_nuevo_parent (NULL = root), right
-- after the active sibling p_despues_de (NULL = first position).
--   - one structural change per cedulario at a time (advisory lock, the same
--     key materias_guard uses; the lock is re-entrant inside a transaction)
--   - new orden = floor-midpoint of the two neighbors; first position:
--     next - 1024; last position: prev + 1024; no neighbors: 1024
--   - when no integer fits strictly between the neighbors, the active siblings
--     OTHER than the moved row are renumbered at multiples of 1024 (keeping
--     their relative order) with cedularios.suprimir_orden = 'on' so the audit
--     trigger does not log those orden changes; the moved row is placed after
--   - only parent_id and orden of the moved row are updated; materias_guard
--     checks cycle (CD002), parent (CD003), depth (CD001) and the codigo
--     collision (unique violation of uq_materias_codigo_hermanos)
-- Mirrors aplicarMovimiento in lib/cedularios/tree.ts and ordenEntre /
-- rebalancear in lib/cedularios/orden.ts.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mover_materia(
  p_id           uuid,
  p_nuevo_parent uuid,
  p_despues_de   uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_cedulario_id uuid;
  v_prev         integer;
  v_next         integer;
  v_orden        integer;
  v_intento      integer;
  v_filas        integer;
BEGIN
  SELECT m.cedulario_id INTO v_cedulario_id
  FROM public.materias m
  WHERE m.id = p_id;

  IF NOT FOUND THEN
    -- Missing, or hidden from the caller by RLS.
    RAISE EXCEPTION 'cedularios.sin_permisos' USING ERRCODE = '42501';
  END IF;

  IF NOT public.materia_puede_editar(p_id) THEN
    RAISE EXCEPTION 'cedularios.sin_permisos' USING ERRCODE = '42501';
  END IF;

  IF p_despues_de IS NOT NULL AND p_despues_de = p_id THEN
    RAISE EXCEPTION 'cedularios.despues_de_invalido' USING ERRCODE = '23514';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_cedulario_id::text));

  v_orden := NULL;

  -- Attempt 1 uses the stored orden values. If no integer fits between the
  -- neighbors, the siblings are renumbered and attempt 2 always fits (the gap
  -- is then 1024).
  FOR v_intento IN 1..2 LOOP
    IF p_despues_de IS NULL THEN
      v_prev := NULL;

      SELECT m.orden INTO v_next
      FROM public.materias m
      WHERE m.cedulario_id = v_cedulario_id
        AND m.activo
        AND m.parent_id IS NOT DISTINCT FROM p_nuevo_parent
        AND m.id <> p_id
      ORDER BY m.orden, m.id
      LIMIT 1;
    ELSE
      -- p_despues_de must be an active sibling under the target parent.
      SELECT m.orden INTO v_prev
      FROM public.materias m
      WHERE m.id = p_despues_de
        AND m.cedulario_id = v_cedulario_id
        AND m.activo
        AND m.parent_id IS NOT DISTINCT FROM p_nuevo_parent;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'cedularios.despues_de_invalido' USING ERRCODE = '23514';
      END IF;

      SELECT m.orden INTO v_next
      FROM public.materias m
      WHERE m.cedulario_id = v_cedulario_id
        AND m.activo
        AND m.parent_id IS NOT DISTINCT FROM p_nuevo_parent
        AND m.id <> p_id
        AND (m.orden, m.id) > (v_prev, p_despues_de)
      ORDER BY m.orden, m.id
      LIMIT 1;
    END IF;

    IF v_prev IS NULL AND v_next IS NULL THEN
      v_orden := 1024;
    ELSIF v_prev IS NULL THEN
      v_orden := v_next - 1024;
    ELSIF v_next IS NULL THEN
      v_orden := v_prev + 1024;
    ELSIF v_next - v_prev >= 2 THEN
      v_orden := floor((v_prev::numeric + v_next::numeric) / 2)::integer;
    END IF;

    EXIT WHEN v_orden IS NOT NULL;

    -- No integer fits: renumber the active siblings other than the moved row.
    PERFORM set_config('cedularios.suprimir_orden', 'on', true);

    UPDATE public.materias m
    SET orden = r.nuevo_orden
    FROM (
      SELECT s.id,
             (row_number() OVER (ORDER BY s.orden, s.id) * 1024)::integer AS nuevo_orden
      FROM public.materias s
      WHERE s.cedulario_id = v_cedulario_id
        AND s.activo
        AND s.parent_id IS NOT DISTINCT FROM p_nuevo_parent
        AND s.id <> p_id
    ) r
    WHERE m.id = r.id
      AND m.orden <> r.nuevo_orden;

    PERFORM set_config('cedularios.suprimir_orden', 'off', true);
  END LOOP;

  IF v_orden IS NULL THEN
    RAISE EXCEPTION 'cedularios.orden_no_disponible' USING ERRCODE = 'XX000';
  END IF;

  UPDATE public.materias
  SET parent_id = p_nuevo_parent,
      orden     = v_orden
  WHERE id = p_id;

  GET DIAGNOSTICS v_filas = ROW_COUNT;

  IF v_filas = 0 THEN
    RAISE EXCEPTION 'cedularios.sin_permisos' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mover_materia(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mover_materia(uuid, uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- desactivar_materia: soft delete of a materia and its currently ACTIVE
-- descendants. Returns exactly the ids it changed, ancestors first (ascending
-- nivel). Descendants that were already inactive are untouched. Returns an
-- empty array when the materia was already inactive and the caller may edit it.
-- Raises 42501 when the caller cannot edit the materia.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.desactivar_materia(p_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_cedulario_id uuid;
  v_ids          uuid[];
  v_total        integer;
  v_filas        integer;
BEGIN
  SELECT m.cedulario_id INTO v_cedulario_id
  FROM public.materias m
  WHERE m.id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cedularios.sin_permisos' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_cedulario_id::text));

  WITH RECURSIVE subarbol(id, nivel) AS (
    SELECT m.id, m.nivel
    FROM public.materias m
    WHERE m.id = p_id
      AND m.activo
    UNION ALL
    SELECT h.id, h.nivel
    FROM public.materias h
    JOIN subarbol s ON h.parent_id = s.id
    WHERE h.activo
  )
  SELECT COALESCE(array_agg(s.id ORDER BY s.nivel, s.id), '{}'::uuid[])
  INTO v_ids
  FROM subarbol s;

  v_total := COALESCE(cardinality(v_ids), 0);

  IF v_total = 0 THEN
    IF NOT public.materia_puede_editar(p_id) THEN
      RAISE EXCEPTION 'cedularios.sin_permisos' USING ERRCODE = '42501';
    END IF;
    RETURN v_ids;
  END IF;

  -- No RETURNING: see the note in the section header.
  UPDATE public.materias
  SET activo = false
  WHERE id = ANY (v_ids)
    AND activo;

  GET DIAGNOSTICS v_filas = ROW_COUNT;

  IF v_filas < v_total THEN
    -- RLS filtered the update (the caller cannot edit this cedulario).
    RAISE EXCEPTION 'cedularios.sin_permisos' USING ERRCODE = '42501';
  END IF;

  RETURN v_ids;
END;
$$;

REVOKE ALL ON FUNCTION public.desactivar_materia(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.desactivar_materia(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- restaurar_materias: undo of desactivar_materia. All ids must belong to one
-- cedulario (23514 otherwise). Reactivates one row at a time in ascending
-- nivel, so a parent is active before its children. A codigo collision raises
-- the unique violation of uq_materias_codigo_hermanos; an inactive parent
-- raises CD003 (materias_guard). Everything rolls back on any error.
-- SECURITY DEFINER: inactive materias are hidden by RLS from everyone except
-- admin, so an invoker function could not find the rows a creator or
-- collaborator needs to restore. The permission check is explicit and equals
-- the materias UPDATE policy (cedulario_puede_editar); non-admin callers can
-- only restore in an active cedulario.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.restaurar_materias(p_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids_unicos   uuid[];
  v_encontradas  integer;
  v_cedularios   integer;
  v_cedulario_id uuid;
  v_id           uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'cedularios.sin_permisos' USING ERRCODE = '42501';
  END IF;

  IF p_ids IS NULL OR COALESCE(cardinality(p_ids), 0) = 0 THEN
    RETURN;
  END IF;

  SELECT array_agg(DISTINCT x.id) INTO v_ids_unicos
  FROM unnest(p_ids) AS x(id)
  WHERE x.id IS NOT NULL;

  -- Duplicated and NULL ids are ignored.
  IF v_ids_unicos IS NULL THEN
    RETURN;
  END IF;

  -- Permission first, so the caller learns nothing about ids it cannot edit.
  IF EXISTS (
    SELECT 1
    FROM public.materias m
    JOIN public.cedularios c ON c.id = m.cedulario_id
    WHERE m.id = ANY (v_ids_unicos)
      AND (
        NOT public.cedulario_puede_editar(m.cedulario_id)
        OR (NOT c.activo AND public.get_user_rol() IS DISTINCT FROM 'admin')
      )
  ) THEN
    RAISE EXCEPTION 'cedularios.sin_permisos' USING ERRCODE = '42501';
  END IF;

  SELECT count(*), count(DISTINCT m.cedulario_id), min(m.cedulario_id::text)::uuid
  INTO v_encontradas, v_cedularios, v_cedulario_id
  FROM public.materias m
  WHERE m.id = ANY (v_ids_unicos);

  IF v_encontradas <> cardinality(v_ids_unicos) OR v_cedularios <> 1 THEN
    -- Some id does not exist, or the ids belong to different cedularios.
    RAISE EXCEPTION 'cedularios.ids_invalidos' USING ERRCODE = '23514';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_cedulario_id::text));

  FOR v_id IN
    SELECT m.id
    FROM public.materias m
    WHERE m.id = ANY (v_ids_unicos)
    ORDER BY m.nivel, m.id
  LOOP
    UPDATE public.materias
    SET activo = true
    WHERE id = v_id
      AND NOT activo;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.restaurar_materias(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restaurar_materias(uuid[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- reordenar_enlaces_cedulario / reordenar_enlaces_materia: p_ids must be
-- exactly the current set of enlace ids (same size, no duplicates, same
-- members), otherwise CD009 (stale list). orden is rewritten as index * 1024
-- (index starts at 1) in the given order. Raises 42501 when RLS blocked the
-- update (the caller cannot edit).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reordenar_enlaces_cedulario(
  p_cedulario_id uuid,
  p_ids          uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_n     integer;
  v_filas integer;
BEGIN
  IF p_ids IS NULL THEN
    RAISE EXCEPTION 'cedularios.lista_desactualizada' USING ERRCODE = 'CD009';
  END IF;

  v_n := COALESCE(cardinality(p_ids), 0);

  PERFORM pg_advisory_xact_lock(hashtext('cedulario_enlaces:' || p_cedulario_id::text));

  IF (SELECT count(DISTINCT x.id) FROM unnest(p_ids) AS x(id)) <> v_n
     OR (SELECT count(*) FROM public.cedulario_enlaces e
         WHERE e.cedulario_id = p_cedulario_id) <> v_n
     OR EXISTS (
       SELECT 1
       FROM unnest(p_ids) AS x(id)
       WHERE NOT EXISTS (
         SELECT 1
         FROM public.cedulario_enlaces e
         WHERE e.id = x.id
           AND e.cedulario_id = p_cedulario_id
       )
     ) THEN
    RAISE EXCEPTION 'cedularios.lista_desactualizada' USING ERRCODE = 'CD009';
  END IF;

  IF v_n = 0 THEN
    RETURN;
  END IF;

  UPDATE public.cedulario_enlaces e
  SET orden = (t.pos * 1024)::integer
  FROM unnest(p_ids) WITH ORDINALITY AS t(id, pos)
  WHERE e.id = t.id
    AND e.cedulario_id = p_cedulario_id;

  GET DIAGNOSTICS v_filas = ROW_COUNT;

  IF v_filas < v_n THEN
    RAISE EXCEPTION 'cedularios.sin_permisos' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.reordenar_enlaces_cedulario(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reordenar_enlaces_cedulario(uuid, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.reordenar_enlaces_materia(
  p_materia_id uuid,
  p_ids        uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_n     integer;
  v_filas integer;
BEGIN
  IF p_ids IS NULL THEN
    RAISE EXCEPTION 'cedularios.lista_desactualizada' USING ERRCODE = 'CD009';
  END IF;

  v_n := COALESCE(cardinality(p_ids), 0);

  PERFORM pg_advisory_xact_lock(hashtext('materia_enlaces:' || p_materia_id::text));

  IF (SELECT count(DISTINCT x.id) FROM unnest(p_ids) AS x(id)) <> v_n
     OR (SELECT count(*) FROM public.materia_enlaces e
         WHERE e.materia_id = p_materia_id) <> v_n
     OR EXISTS (
       SELECT 1
       FROM unnest(p_ids) AS x(id)
       WHERE NOT EXISTS (
         SELECT 1
         FROM public.materia_enlaces e
         WHERE e.id = x.id
           AND e.materia_id = p_materia_id
       )
     ) THEN
    RAISE EXCEPTION 'cedularios.lista_desactualizada' USING ERRCODE = 'CD009';
  END IF;

  IF v_n = 0 THEN
    RETURN;
  END IF;

  UPDATE public.materia_enlaces e
  SET orden = (t.pos * 1024)::integer
  FROM unnest(p_ids) WITH ORDINALITY AS t(id, pos)
  WHERE e.id = t.id
    AND e.materia_id = p_materia_id;

  GET DIAGNOSTICS v_filas = ROW_COUNT;

  IF v_filas < v_n THEN
    RAISE EXCEPTION 'cedularios.sin_permisos' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.reordenar_enlaces_materia(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reordenar_enlaces_materia(uuid, uuid[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- buscar_materias: ids of the ACTIVE materias of a cedulario whose codigo,
-- nombre, descripcion or temario_texto contain p_q (ILIKE). The query is
-- trimmed and cut to 100 characters; %, _ and \ are escaped so they match
-- literally. An empty or blank query returns nothing. RLS decides visibility.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.buscar_materias(
  p_cedulario_id uuid,
  p_q            text
)
RETURNS TABLE (id uuid)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_q      text;
  v_patron text;
BEGIN
  v_q := left(btrim(COALESCE(p_q, ''), E' \t\r\n'), 100);

  IF v_q = '' THEN
    RETURN;
  END IF;

  v_patron := '%'
    || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_')
    || '%';

  RETURN QUERY
  SELECT m.id
  FROM public.materias m
  WHERE m.cedulario_id = p_cedulario_id
    AND m.activo
    AND (
      m.codigo        ILIKE v_patron
      OR m.nombre     ILIKE v_patron
      OR m.descripcion ILIKE v_patron
      OR m.temario_texto ILIKE v_patron
    )
  ORDER BY m.nivel, m.orden, m.id;
END;
$$;

REVOKE ALL ON FUNCTION public.buscar_materias(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buscar_materias(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- get_historial_cedulario: change history of a cedulario, newest first, with
-- keyset pagination.
--   - admin and profesor only; any other role gets no rows (Req 8.14). A
--     profesor also needs the cedulario to be visible (active); admin may read
--     the history of an inactive or purged cedulario.
--   - filters: tabla, usuario_id, created_at range. p_desde / p_hasta are
--     inclusive; the UI sends the start of the 'desde' day and the end of the
--     'hasta' day.
--   - ORDER BY created_at DESC, id DESC; the next page is requested with the
--     created_at and id of the last row received.
--   - LIMIT least(p_limit, 100); p_limit NULL or below 1 means 50.
--   - usuario_nombre is 'nombre apellido', NULL when usuario_id is NULL or the
--     profile no longer exists (the UI shows 'Usuario desconocido').
-- SECURITY DEFINER so it does not depend on RLS over profiles.
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

-- ---------------------------------------------------------------------------
-- listar_colaboradores: collaborators of a cedulario with their names.
-- Admin and profesor only (42501 for any other role). A profesor sees the list
-- only while the cedulario is active (same rule as the cedulario_profesores
-- SELECT policy); admin sees it always.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.listar_colaboradores(p_cedulario_id uuid)
RETURNS TABLE (
  id         uuid,
  nombre     text,
  apellido   text,
  granted_by uuid,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol text;
BEGIN
  v_rol := public.get_user_rol()::text;

  IF auth.uid() IS NULL OR v_rol IS NULL OR v_rol NOT IN ('admin', 'profesor') THEN
    RAISE EXCEPTION 'cedularios.sin_permisos' USING ERRCODE = '42501';
  END IF;

  IF v_rol <> 'admin' AND NOT EXISTS (
    SELECT 1
    FROM public.cedularios c
    WHERE c.id = p_cedulario_id
      AND c.activo
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id,
         p.nombre,
         p.apellido,
         cp.granted_by,
         cp.created_at
  FROM public.cedulario_profesores cp
  JOIN public.profiles p ON p.id = cp.profesor_id
  WHERE cp.cedulario_id = p_cedulario_id
  ORDER BY cp.created_at, p.id;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_colaboradores(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_colaboradores(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- listar_profesores_cedularios: every ACTIVE profile with rol 'profesor'
-- (candidates for the collaborator picker). Admin and profesor only (42501).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.listar_profesores_cedularios()
RETURNS TABLE (
  id       uuid,
  nombre   text,
  apellido text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol text;
BEGIN
  v_rol := public.get_user_rol()::text;

  IF auth.uid() IS NULL OR v_rol IS NULL OR v_rol NOT IN ('admin', 'profesor') THEN
    RAISE EXCEPTION 'cedularios.sin_permisos' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.id,
         p.nombre,
         p.apellido
  FROM public.profiles p
  WHERE p.rol::text = 'profesor'
    AND p.activo
  ORDER BY p.nombre, p.apellido, p.id;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_profesores_cedularios() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_profesores_cedularios() TO authenticated;

-- ---------------------------------------------------------------------------
-- desactivar_cedulario / desactivar_universidad: soft delete without a
-- RETURNING clause (see the section header). Return true when a row was
-- deactivated, false when none matched (missing, already inactive, or not
-- updatable by the caller). RLS limits who can update; the guard triggers raise
-- CD007 (not creator or admin), CD008 (assignments) and CD004 (universidad
-- with active cedularios).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.desactivar_cedulario(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_filas integer;
BEGIN
  UPDATE public.cedularios
  SET activo = false
  WHERE id = p_id
    AND activo;

  GET DIAGNOSTICS v_filas = ROW_COUNT;

  RETURN v_filas > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.desactivar_cedulario(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.desactivar_cedulario(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.desactivar_universidad(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_filas integer;
BEGIN
  UPDATE public.universidades
  SET activo = false
  WHERE id = p_id
    AND activo;

  GET DIAGNOSTICS v_filas = ROW_COUNT;

  RETURN v_filas > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.desactivar_universidad(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.desactivar_universidad(uuid) TO authenticated;

-- =============================================================================
-- END OF SECTION 6: RPC FUNCTIONS
-- =============================================================================

-- =============================================================================
-- SECTION 7: STORAGE BUCKET, REALTIME PUBLICATION AND PHASE 2 NOTES
-- =============================================================================
-- Storage: public bucket for university logos (same pattern as migrations 004
-- and 056). Realtime: invalidation signals for the open cedulario (same guard
-- pattern as migrations 002 and 048). Phase 2: comments only, no DDL.

-- ---------------------------------------------------------------------------
-- 7.1 Storage bucket cedularios-logos
-- Public read (logos are shown to every role and on public pages). 2 MB limit
-- and an image MIME allow-list, also checked in the browser by validarLogo().
-- Objects are stored as <universidad_id>/<uuid>.<ext>.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cedularios-logos',
  'cedularios-logos',
  true,
  2097152,
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/avif',
    'image/svg+xml'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/avif',
    'image/svg+xml'
  ];

-- ---------------------------------------------------------------------------
-- 7.2 Storage policies on storage.objects (scoped to this bucket only)
-- Read: everyone. Write (insert / update / delete): authenticated users whose
-- role is admin or profesor. get_user_rol() is wrapped in a SELECT so it is
-- evaluated once per statement instead of once per row.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "cedularios_logos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "cedularios_logos_staff_insert" ON storage.objects;
DROP POLICY IF EXISTS "cedularios_logos_staff_update" ON storage.objects;
DROP POLICY IF EXISTS "cedularios_logos_staff_delete" ON storage.objects;

CREATE POLICY "cedularios_logos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'cedularios-logos');

CREATE POLICY "cedularios_logos_staff_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'cedularios-logos'
    AND (SELECT public.get_user_rol()) IN ('admin', 'profesor')
  );

CREATE POLICY "cedularios_logos_staff_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'cedularios-logos'
    AND (SELECT public.get_user_rol()) IN ('admin', 'profesor')
  )
  WITH CHECK (
    bucket_id = 'cedularios-logos'
    AND (SELECT public.get_user_rol()) IN ('admin', 'profesor')
  );

CREATE POLICY "cedularios_logos_staff_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'cedularios-logos'
    AND (SELECT public.get_user_rol()) IN ('admin', 'profesor')
  );

-- ---------------------------------------------------------------------------
-- 7.3 Realtime publication
-- The client treats Realtime events as invalidation signals only (never as
-- data). Added tables: cedularios, materias, cedulario_enlaces,
-- materia_enlaces, cedulario_profesores. NOT added: universidades (the list
-- refreshes by staleTime) and historial_cambios (loaded on open and on an
-- explicit refresh). Each addition is guarded so the block can run again.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'cedularios'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cedularios;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'materias'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.materias;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'cedulario_enlaces'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cedulario_enlaces;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'materia_enlaces'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.materia_enlaces;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'cedulario_profesores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cedulario_profesores;
  END IF;
END $$;

-- REPLICA IDENTITY FULL only on the three small tables, so their UPDATE and
-- DELETE events carry the old row. It is NOT set on materias: rows there can
-- hold a large temario (up to 200000 bytes) and every UPDATE would write it
-- twice to the WAL. materias events rely on the primary key and on the
-- cedulario_id filter of INSERT / UPDATE events.
ALTER TABLE public.cedulario_enlaces    REPLICA IDENTITY FULL;
ALTER TABLE public.materia_enlaces      REPLICA IDENTITY FULL;
ALTER TABLE public.cedulario_profesores REPLICA IDENTITY FULL;

-- ---------------------------------------------------------------------------
-- 7.4 Phase 2 notes (COMMENTS ONLY, no DDL in this migration)
-- ---------------------------------------------------------------------------
-- Phase 2 adds student assignments and progress. Planned tables, to be
-- created by a later migration:
--
--   cedulario_asignaciones (id, cedulario_id, alumno_id, estado, ...)
--     One row per alumno assigned to a cedulario.
--
--   materia_progreso (id, asignacion_id, materia_id, estado, fecha, notas,
--                     repeticiones)
--     One row per alumno and materia: progress state, date, notes and the
--     number of repetitions.
--
--   materia_progreso_clases (id, progreso_id, horario_id)
--     Links a progress record to the classes of the horarios table.
--
-- Foreign keys: every Phase 2 table that points at materias(id) or
-- cedularios(id) uses ON DELETE RESTRICT, so a materia or cedulario that has
-- progress or assignments cannot be physically deleted by mistake.
--
-- Why Phase 1 is already compatible:
--   - Phase 1 never hard-deletes materias from the app. desactivar_materia()
--     only sets activo = false, so materia ids stay stable and Phase 2
--     progress rows keep a valid reference. Physical DELETE stays admin-only
--     (section 5), and the RESTRICT keys above will block it when progress
--     exists.
--   - cedulario_tiene_asignaciones(p_id) is a stub returning false (section
--     2). Phase 2 replaces it with CREATE OR REPLACE FUNCTION so that it
--     checks cedulario_asignaciones. cedularios_guard() already calls it and
--     raises CD008 when a cedulario with assignments is deactivated, so no
--     trigger change is needed.
--   - Alumno read access needs no change in the Phase 1 policies: every
--     authenticated user can already read active cedularios and their active
--     materias (section 5). Phase 2 only adds policies for the new tables.
--   - historial_cambios.tabla, campo and metadata (jsonb) are free-form, so
--     Phase 2 events (assignment created, progress changed, class linked)
--     can be written to the same table without any schema migration.
-- ---------------------------------------------------------------------------

-- =============================================================================
-- END OF SECTION 7: STORAGE BUCKET, REALTIME PUBLICATION AND PHASE 2 NOTES
-- =============================================================================
