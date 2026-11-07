-- =============================================================================
-- 155_cedulario_nivel_10_e_importacion.sql
--
-- 1. Raises the maximum depth of the materias tree from 5 to 10 levels:
--    the CHECK on materias.nivel and the two literals of materias_guard()
--    (CD001). Everything else in the guard is copied from migration 152.
-- 2. importar_cedulario(): transactional import of a whole cedulario (or of the
--    tree of an empty existing one) from a JSON array of materias.
--
-- New SQLSTATE:
--   CD017  import target is not empty (existing cedulario with active materias
--          or with assignments). Mapped to 'cedulario_no_vacio' in
--          lib/cedularios/errors.ts.
--
-- Idempotent: safe to run more than once.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- materias.nivel CHECK: 1..10. The inline CHECK of migration 152 is unnamed by
-- us, so look it up by definition and drop whichever constraint constrains
-- nivel; then add the named one when it does not exist yet.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_nombre text;
BEGIN
  FOR v_nombre IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.materias'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%nivel%'
      AND c.conname <> 'materias_nivel_check_10'
  LOOP
    EXECUTE format('ALTER TABLE public.materias DROP CONSTRAINT %I', v_nombre);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.materias'::regclass
      AND c.conname = 'materias_nivel_check_10'
  ) THEN
    ALTER TABLE public.materias
      ADD CONSTRAINT materias_nivel_check_10 CHECK (nivel BETWEEN 1 AND 10);
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- materias_guard: BEFORE INSERT OR UPDATE ON materias (row level)
--   - serializes structural changes per cedulario (advisory lock)
--   - cedulario_id is immutable
--   - derives nivel from the parent (never client-set)
--   - rejects cycles (CD002), depth > 10 including the moved subtree (CD001)
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
    IF NEW.nivel > 10 THEN
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

    -- nivel + height - 1 > 10, with height = 1 + deepest descendant offset.
    IF NEW.nivel + v_altura_desc > 10 THEN
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
-- importar_cedulario: creates a cedulario with its whole materias tree in one
-- transaction (any error rolls everything back), or fills an EMPTY existing
-- cedulario when p_cedulario_id is given.
--
-- p_materias: jsonb array of {id uuid, parent_id uuid|null, depth int 1..10,
--   codigo text, nombre text, orden int}. The caller generates the ids so the
--   parent links are known up front; depth is a hint that must agree with the
--   parent's depth. orden 0/null means "append" (the guard computes it).
--
-- SECURITY INVOKER: RLS, the guard triggers (materias_guard, cedularios_guard)
-- and the audit trigger all apply as for plain inserts. A BEFORE ROW trigger
-- cannot see rows of its own INSERT statement, so rows are inserted one
-- statement per depth, parents first.
--
-- Errors: 42501 no permission, 23514 invalid input, CD001 too deep, CD003
-- parent not found at the previous depth, CD017 target not empty, plus the
-- codigo unique violation of uq_materias_codigo_hermanos.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.importar_cedulario(
  p_universidad_id uuid,
  p_nombre         text,
  p_version        text,
  p_descripcion    text,
  p_materias       jsonb,
  p_cedulario_id   uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_rol      text;
  v_id       uuid;
  v_total    integer;
  v_nivel    integer;
  v_insertas integer;
BEGIN
  v_rol := public.get_user_rol()::text;
  IF auth.uid() IS NULL OR v_rol IS NULL OR v_rol NOT IN ('admin', 'profesor') THEN
    RAISE EXCEPTION 'cedularios.sin_permisos' USING ERRCODE = '42501';
  END IF;

  IF p_materias IS NULL OR jsonb_typeof(p_materias) <> 'array' THEN
    RAISE EXCEPTION 'cedularios.importacion_invalida' USING ERRCODE = '23514';
  END IF;

  v_total := jsonb_array_length(p_materias);
  IF v_total < 1 OR v_total > 5000 THEN
    RAISE EXCEPTION 'cedularios.importacion_invalida' USING ERRCODE = '23514';
  END IF;

  -- Shape: every element is an object with uuid id, int depth, text codigo and
  -- nombre; parent_id (when present) is a uuid. Anything else is invalid input.
  BEGIN
    PERFORM 1
    FROM jsonb_to_recordset(p_materias) AS r(
      id uuid, parent_id uuid, depth integer, codigo text, nombre text, orden integer
    );
  EXCEPTION
    WHEN invalid_text_representation OR invalid_parameter_value
         OR datatype_mismatch OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'cedularios.importacion_invalida' USING ERRCODE = '23514';
  END;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_materias) e
    WHERE jsonb_typeof(e) <> 'object'
  ) THEN
    RAISE EXCEPTION 'cedularios.importacion_invalida' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_materias) AS r(
      id uuid, parent_id uuid, depth integer, codigo text, nombre text, orden integer
    )
    WHERE r.id IS NULL
       OR r.depth IS NULL
       OR r.depth < 1
       OR r.codigo IS NULL
       OR r.nombre IS NULL
       OR (r.depth = 1 AND r.parent_id IS NOT NULL)
       OR (r.depth > 1 AND r.parent_id IS NULL)
       OR COALESCE(r.orden, 0) < 0
  ) THEN
    RAISE EXCEPTION 'cedularios.importacion_invalida' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_materias) AS r(
      id uuid, parent_id uuid, depth integer, codigo text, nombre text, orden integer
    )
    WHERE r.depth > 10
  ) THEN
    RAISE EXCEPTION 'cedularios.nivel_maximo' USING ERRCODE = 'CD001';
  END IF;

  -- Each parent must be in the payload, exactly one depth above its child.
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_materias) AS h(
      id uuid, parent_id uuid, depth integer, codigo text, nombre text, orden integer
    )
    LEFT JOIN jsonb_to_recordset(p_materias) AS p(
      id uuid, parent_id uuid, depth integer, codigo text, nombre text, orden integer
    ) ON p.id = h.parent_id
    WHERE h.parent_id IS NOT NULL
      AND (p.id IS NULL OR p.depth <> h.depth - 1)
  ) THEN
    RAISE EXCEPTION 'cedularios.padre_invalido' USING ERRCODE = 'CD003';
  END IF;

  -- Target cedulario.
  IF p_cedulario_id IS NULL THEN
    INSERT INTO public.cedularios (universidad_id, nombre, version, descripcion)
    VALUES (p_universidad_id, p_nombre, p_version, p_descripcion)
    RETURNING id INTO v_id;
  ELSE
    IF NOT public.cedulario_puede_editar(p_cedulario_id) THEN
      RAISE EXCEPTION 'cedularios.sin_permisos' USING ERRCODE = '42501';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext(p_cedulario_id::text));

    IF EXISTS (
         SELECT 1 FROM public.materias m
         WHERE m.cedulario_id = p_cedulario_id AND m.activo
       )
       OR public.cedulario_tiene_asignaciones(p_cedulario_id) THEN
      RAISE EXCEPTION 'cedularios.cedulario_no_vacio' USING ERRCODE = 'CD017';
    END IF;

    v_id := p_cedulario_id;
  END IF;

  -- One INSERT per depth so the guard finds each parent already stored.
  FOR v_nivel IN 1..10 LOOP
    INSERT INTO public.materias (id, cedulario_id, parent_id, codigo, nombre, orden)
    SELECT r.id, v_id, r.parent_id, r.codigo, r.nombre, COALESCE(r.orden, 0)
    FROM jsonb_to_recordset(p_materias) AS r(
      id uuid, parent_id uuid, depth integer, codigo text, nombre text, orden integer
    )
    WHERE r.depth = v_nivel
    ORDER BY COALESCE(r.orden, 0);

    GET DIAGNOSTICS v_insertas = ROW_COUNT;
    EXIT WHEN v_insertas = 0 AND v_nivel > 1;
  END LOOP;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.importar_cedulario(uuid, text, text, text, jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.importar_cedulario(uuid, text, text, text, jsonb, uuid) TO authenticated;
