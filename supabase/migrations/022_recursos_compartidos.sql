-- =============================================================
-- 022_recursos_compartidos.sql
-- Tables and RLS for the Shared Files / Recursos Compartidos feature
-- =============================================================

-- -------------------------------------------------------
-- 1. recursos_compartidos — the resource catalog
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS recursos_compartidos (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo        TEXT        NOT NULL,
  descripcion   TEXT,
  tipo          TEXT        NOT NULL CHECK (tipo IN ('archivo', 'enlace', 'video')),
  -- For tipo='archivo': storage object path relative to bucket root
  -- For tipo='enlace'|'video': the external URL
  url           TEXT,
  storage_path  TEXT,       -- only set when tipo='archivo'
  subido_por    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- true  → visible to all students (for admin) or all of uploader's students (for profesor)
  para_todos    BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE recursos_compartidos ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- 2. recursos_acceso — explicit per-alumno grants
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS recursos_acceso (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recurso_id  UUID        NOT NULL REFERENCES recursos_compartidos(id) ON DELETE CASCADE,
  alumno_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (recurso_id, alumno_id)
);

ALTER TABLE recursos_acceso ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------
-- 3. updated_at trigger (reuse pattern from existing tables)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION recursos_compartidos_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER recursos_compartidos_updated_at
  BEFORE UPDATE ON recursos_compartidos
  FOR EACH ROW EXECUTE FUNCTION recursos_compartidos_set_updated_at();

-- -------------------------------------------------------
-- 4. RLS policies — recursos_compartidos
-- -------------------------------------------------------

-- ADMIN: full access
CREATE POLICY "admin: full access recursos_compartidos"
  ON recursos_compartidos
  FOR ALL
  TO authenticated
  USING (
    (SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- PROFESOR: select own resources + resources visible to their students
CREATE POLICY "profesor: select own recursos"
  ON recursos_compartidos
  FOR SELECT
  TO authenticated
  USING (
    (SELECT rol FROM profiles WHERE id = auth.uid()) = 'profesor'
    AND subido_por = auth.uid()
  );

-- PROFESOR: insert/update/delete own resources
CREATE POLICY "profesor: insert own recurso"
  ON recursos_compartidos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT rol FROM profiles WHERE id = auth.uid()) = 'profesor'
    AND subido_por = auth.uid()
  );

CREATE POLICY "profesor: update own recurso"
  ON recursos_compartidos
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT rol FROM profiles WHERE id = auth.uid()) = 'profesor'
    AND subido_por = auth.uid()
  )
  WITH CHECK (
    subido_por = auth.uid()
  );

CREATE POLICY "profesor: delete own recurso"
  ON recursos_compartidos
  FOR DELETE
  TO authenticated
  USING (
    (SELECT rol FROM profiles WHERE id = auth.uid()) = 'profesor'
    AND subido_por = auth.uid()
  );

-- ALUMNO: read resources assigned to them or marked para_todos
-- (para_todos on a profesor resource = all students assigned to that profesor)
-- We handle the profesor-scope logic in the RPC; the policy allows reading any
-- para_todos resource or one explicitly granted.
CREATE POLICY "alumno: select accessible recursos"
  ON recursos_compartidos
  FOR SELECT
  TO authenticated
  USING (
    (SELECT rol FROM profiles WHERE id = auth.uid()) = 'alumno'
    AND (
      -- Explicitly granted via recursos_acceso
      EXISTS (
        SELECT 1 FROM recursos_acceso ra
        WHERE ra.recurso_id = recursos_compartidos.id
          AND ra.alumno_id = auth.uid()
      )
      -- OR global resource (admin para_todos)
      OR (para_todos = true AND (SELECT rol FROM profiles WHERE id = subido_por) = 'admin')
      -- OR profesor's para_todos resource where alumno is assigned to that profesor
      OR (
        para_todos = true
        AND EXISTS (
          SELECT 1 FROM alumnos_extra ae
          WHERE ae.alumno_id = auth.uid()
            AND ae.profesor_id = subido_por
        )
      )
    )
  );

-- -------------------------------------------------------
-- 5. RLS policies — recursos_acceso
-- -------------------------------------------------------

-- ADMIN: full access
CREATE POLICY "admin: full access recursos_acceso"
  ON recursos_acceso
  FOR ALL
  TO authenticated
  USING (
    (SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- PROFESOR: can manage acceso for resources they uploaded
CREATE POLICY "profesor: manage acceso own recursos"
  ON recursos_acceso
  FOR ALL
  TO authenticated
  USING (
    (SELECT rol FROM profiles WHERE id = auth.uid()) = 'profesor'
    AND EXISTS (
      SELECT 1 FROM recursos_compartidos rc
      WHERE rc.id = recursos_acceso.recurso_id
        AND rc.subido_por = auth.uid()
    )
  )
  WITH CHECK (
    (SELECT rol FROM profiles WHERE id = auth.uid()) = 'profesor'
    AND EXISTS (
      SELECT 1 FROM recursos_compartidos rc
      WHERE rc.id = recursos_acceso.recurso_id
        AND rc.subido_por = auth.uid()
    )
  );

-- ALUMNO: can only see their own access grants (no mutations)
CREATE POLICY "alumno: select own accesos"
  ON recursos_acceso
  FOR SELECT
  TO authenticated
  USING (
    (SELECT rol FROM profiles WHERE id = auth.uid()) = 'alumno'
    AND alumno_id = auth.uid()
  );

-- -------------------------------------------------------
-- 6. RPC: get_recursos_for_user
-- Returns all resources the calling user can see,
-- joined with uploader name and access info.
-- Avoids N+1 queries on the client side.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION get_recursos_for_user()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id  UUID := auth.uid();
  v_rol      TEXT;
BEGIN
  SELECT rol INTO v_rol FROM profiles WHERE id = v_user_id;

  IF v_rol = 'admin' THEN
    -- Admin sees all resources with uploader info and access count
    RETURN (
      SELECT json_agg(row_to_json(r))
      FROM (
        SELECT
          rc.*,
          p.nombre || ' ' || p.apellido AS uploader_nombre,
          (SELECT COUNT(*) FROM recursos_acceso ra WHERE ra.recurso_id = rc.id) AS acceso_count
        FROM recursos_compartidos rc
        JOIN profiles p ON p.id = rc.subido_por
        ORDER BY rc.created_at DESC
      ) r
    );

  ELSIF v_rol = 'profesor' THEN
    -- Profesor sees only their own resources
    RETURN (
      SELECT json_agg(row_to_json(r))
      FROM (
        SELECT
          rc.*,
          p.nombre || ' ' || p.apellido AS uploader_nombre,
          (SELECT COUNT(*) FROM recursos_acceso ra WHERE ra.recurso_id = rc.id) AS acceso_count
        FROM recursos_compartidos rc
        JOIN profiles p ON p.id = rc.subido_por
        WHERE rc.subido_por = v_user_id
        ORDER BY rc.created_at DESC
      ) r
    );

  ELSIF v_rol = 'alumno' THEN
    -- Alumno sees resources explicitly granted or globally accessible
    RETURN (
      SELECT json_agg(row_to_json(r))
      FROM (
        SELECT
          rc.id,
          rc.titulo,
          rc.descripcion,
          rc.tipo,
          rc.url,
          rc.storage_path,
          rc.para_todos,
          rc.created_at,
          p.nombre || ' ' || p.apellido AS uploader_nombre
        FROM recursos_compartidos rc
        JOIN profiles p ON p.id = rc.subido_por
        WHERE
          -- Explicit grant
          EXISTS (
            SELECT 1 FROM recursos_acceso ra
            WHERE ra.recurso_id = rc.id AND ra.alumno_id = v_user_id
          )
          -- Admin global
          OR (rc.para_todos = true AND (SELECT rol FROM profiles WHERE id = rc.subido_por) = 'admin')
          -- Profesor's para_todos for assigned students
          OR (
            rc.para_todos = true
            AND EXISTS (
              SELECT 1 FROM alumnos_extra ae
              WHERE ae.alumno_id = v_user_id AND ae.profesor_id = rc.subido_por
            )
          )
        ORDER BY rc.created_at DESC
      ) r
    );
  END IF;

  RETURN '[]'::JSON;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_recursos_for_user() TO authenticated;
