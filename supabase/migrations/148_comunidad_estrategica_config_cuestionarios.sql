-- ============================================================
-- Migration 148: Comunidad Estratégica — Configuración de Cuestionarios
-- ============================================================
-- El admin puede personalizar cómo se ven las materias y sus categorías en
-- el juego, sin tocar el banco de preguntas:
--   · icono (de una galería o imagen propia), color, descripción corta,
--   · visibilidad (ocultar del juego) y orden manual,
--   · (materia) preguntas por cuestionario (ya existía, ahora con UI).
--
--   1. game_quiz_subject_settings: columnas de presentación;
--      quiz_question_count pasa a ser opcional (NULL = usar el global).
--   2. game_quiz_category_settings: lo mismo por (materia, categoría). Las
--      categorías del banco son globales; la config es por par porque una
--      misma categoría puede aparecer en varias materias.
--   3. Bucket público 'game-quiz-icons' para las imágenes propias.
--   4. get_quiz_subjects / get_quiz_categories (jugador): devuelven la
--      presentación, excluyen lo oculto, respetan el orden manual, cuentan
--      sólo preguntas jugables (sin open_ended) y cuántas veces jugó el
--      usuario cada materia/categoría.
--   5. start_quiz: rechaza materias/categorías ocultas y, en "todas las
--      categorías", excluye preguntas de categorías ocultas.
--   6. Admin: admin_get_quiz_config, admin_save_quiz_item,
--      admin_reorder_quiz_items; get_game_admin_bootstrap incluye quiz_config.
-- ============================================================


-- ── 1. Materias: presentación ─────────────────────────────────
ALTER TABLE game_quiz_subject_settings
  ALTER COLUMN quiz_question_count DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS icon_key        TEXT,
  ADD COLUMN IF NOT EXISTS icon_image_path TEXT,
  ADD COLUMN IF NOT EXISTS color_key       TEXT,
  ADD COLUMN IF NOT EXISTS description     TEXT CHECK (description IS NULL OR char_length(description) <= 140),
  ADD COLUMN IF NOT EXISTS is_hidden       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order      INTEGER;


-- ── 2. Categorías (por materia): presentación ─────────────────
CREATE TABLE IF NOT EXISTS game_quiz_category_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant          TEXT NOT NULL,
  subject_id      UUID NOT NULL REFERENCES qb_subjects(id) ON DELETE CASCADE,
  category_id     UUID NOT NULL REFERENCES qb_categories(id) ON DELETE CASCADE,
  icon_key        TEXT,
  icon_image_path TEXT,
  color_key       TEXT,
  description     TEXT CHECK (description IS NULL OR char_length(description) <= 140),
  is_hidden       BOOLEAN NOT NULL DEFAULT false,
  sort_order      INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT game_quiz_category_settings_unique UNIQUE (tenant, subject_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_game_quiz_category_settings_subject
  ON game_quiz_category_settings (tenant, subject_id);

DROP TRIGGER IF EXISTS game_quiz_category_settings_updated_at ON game_quiz_category_settings;
CREATE TRIGGER game_quiz_category_settings_updated_at
  BEFORE UPDATE ON game_quiz_category_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sin políticas: lecturas y escrituras van por RPC SECURITY DEFINER.
ALTER TABLE game_quiz_category_settings ENABLE ROW LEVEL SECURITY;


-- ── 3. Bucket de iconos propios ───────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('game-quiz-icons', 'game-quiz-icons', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'game_quiz_icons_public_read'
  ) THEN
    CREATE POLICY "game_quiz_icons_public_read"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'game-quiz-icons');
  END IF;
END $$;


-- ── 4a. get_quiz_subjects (jugador) ───────────────────────────
CREATE OR REPLACE FUNCTION get_quiz_subjects(p_tenant TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user   UUID := auth.uid();
  v_global INTEGER;
  v_result JSONB;
BEGIN
  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(quiz_question_count, 10) INTO v_global FROM game_settings WHERE tenant = p_tenant;
  v_global := COALESCE(v_global, 10);

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'active_question_count', s.cnt,
      'effective_question_count', LEAST(COALESCE(ss.quiz_question_count, v_global), s.cnt),
      'category_count', s.cats,
      'icon_key', ss.icon_key,
      'icon_image_path', ss.icon_image_path,
      'color_key', ss.color_key,
      'description', ss.description,
      'played_count', COALESCE(pc.n, 0)
    ) ORDER BY ss.sort_order ASC NULLS LAST, s.name
  ), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT sub.id, sub.name, count(q.id) AS cnt, count(DISTINCT q.category_id) AS cats
    FROM qb_subjects sub
    JOIN qb_questions q
      ON q.subject_id = sub.id AND q.tenant = p_tenant
     AND q.status = 'active' AND q.type <> 'open_ended'
    LEFT JOIN game_quiz_category_settings cs
      ON cs.tenant = p_tenant AND cs.subject_id = sub.id AND cs.category_id = q.category_id
    WHERE sub.tenant = p_tenant AND NOT COALESCE(cs.is_hidden, false)
    GROUP BY sub.id, sub.name
    HAVING count(q.id) > 0
  ) s
  LEFT JOIN game_quiz_subject_settings ss ON ss.tenant = p_tenant AND ss.subject_id = s.id
  LEFT JOIN (
    SELECT subject_id, count(*)::int AS n
    FROM game_point_events
    WHERE tenant = p_tenant AND user_id = v_user AND action_type = 'quiz_completed'
    GROUP BY subject_id
  ) pc ON pc.subject_id = s.id
  WHERE NOT COALESCE(ss.is_hidden, false);

  RETURN jsonb_build_object('subjects', v_result);
END;
$$;


-- ── 4b. get_quiz_categories (jugador) ─────────────────────────
CREATE OR REPLACE FUNCTION get_quiz_categories(p_tenant TEXT, p_subject_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user   UUID := auth.uid();
  v_result JSONB;
BEGIN
  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', cat.id,
      'name', cat.name,
      'active_question_count', cat.cnt,
      'icon_key', cs.icon_key,
      'icon_image_path', cs.icon_image_path,
      'color_key', cs.color_key,
      'description', cs.description,
      'played_count', COALESCE(pc.n, 0)
    ) ORDER BY cs.sort_order ASC NULLS LAST, cat.name
  ), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT c.id, c.name, count(q.id) AS cnt
    FROM qb_categories c
    JOIN qb_questions q
      ON q.category_id = c.id AND q.tenant = p_tenant
     AND q.status = 'active' AND q.type <> 'open_ended'
     AND q.subject_id = p_subject_id
    WHERE c.tenant = p_tenant
    GROUP BY c.id, c.name
    HAVING count(q.id) > 0
  ) cat
  LEFT JOIN game_quiz_category_settings cs
    ON cs.tenant = p_tenant AND cs.subject_id = p_subject_id AND cs.category_id = cat.id
  LEFT JOIN (
    SELECT category_id, count(*)::int AS n
    FROM game_point_events
    WHERE tenant = p_tenant AND user_id = v_user AND action_type = 'quiz_completed'
      AND subject_id = p_subject_id
    GROUP BY category_id
  ) pc ON pc.category_id = cat.id
  WHERE NOT COALESCE(cs.is_hidden, false);

  RETURN jsonb_build_object('categories', v_result);
END;
$$;


-- ── 5. start_quiz: respeta lo oculto ──────────────────────────
CREATE OR REPLACE FUNCTION start_quiz(p_tenant TEXT, p_subject_id UUID, p_category_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     UUID := auth.uid();
  v_count       INTEGER;
  v_available   INTEGER;
  v_take        INTEGER;
  v_questions   JSONB;
BEGIN
  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'UNAUTHENTICATED');
  END IF;
  IF player_is_banned(p_tenant, v_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'PLAYER_BANNED');
  END IF;
  IF NOT player_has_life(p_tenant, v_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NO_LIVES');
  END IF;

  -- Hidden subject or hidden category: not playable.
  IF EXISTS (
    SELECT 1 FROM game_quiz_subject_settings
    WHERE tenant = p_tenant AND subject_id = p_subject_id AND is_hidden
  ) OR (p_category_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM game_quiz_category_settings
    WHERE tenant = p_tenant AND subject_id = p_subject_id AND category_id = p_category_id AND is_hidden
  )) THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NO_QUESTIONS');
  END IF;

  SELECT COALESCE(
    (SELECT quiz_question_count FROM game_quiz_subject_settings
      WHERE tenant = p_tenant AND subject_id = p_subject_id),
    (SELECT quiz_question_count FROM game_settings WHERE tenant = p_tenant),
    10
  ) INTO v_count;

  SELECT count(*) INTO v_available
  FROM qb_questions q
  WHERE q.tenant = p_tenant
    AND q.status = 'active'
    AND q.type <> 'open_ended'
    AND q.subject_id = p_subject_id
    AND (p_category_id IS NULL OR q.category_id = p_category_id)
    AND NOT EXISTS (
      SELECT 1 FROM game_quiz_category_settings cs
      WHERE cs.tenant = p_tenant AND cs.subject_id = p_subject_id
        AND cs.category_id = q.category_id AND cs.is_hidden
    );

  IF v_available = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NO_QUESTIONS');
  END IF;

  v_take := LEAST(v_count, v_available);

  SELECT jsonb_agg(row_to_json(sub.*))
  INTO v_questions
  FROM (
    SELECT
      q.id,
      q.type,
      q.content,
      CASE
        WHEN q.type IN ('single_choice', 'multiple_choice') AND jsonb_typeof(q.options) = 'array' THEN COALESCE(
          (SELECT jsonb_agg(jsonb_build_object('text', elem ->> 'text'))
             FROM jsonb_array_elements(q.options) AS elem),
          '[]'::jsonb
        )
        ELSE '[]'::jsonb
      END AS options,
      CASE
        WHEN q.type = 'matching' AND jsonb_typeof(q.options -> 'pairs') = 'array' THEN COALESCE(
          (SELECT jsonb_agg(p ->> 'left' ORDER BY ord)
             FROM jsonb_array_elements(q.options -> 'pairs') WITH ORDINALITY AS pr(p, ord)),
          '[]'::jsonb
        )
        ELSE NULL
      END AS pairs_left,
      CASE
        WHEN q.type = 'matching' AND jsonb_typeof(q.options -> 'pairs') = 'array' THEN COALESCE(
          (SELECT jsonb_agg(jsonb_build_object('key', ord - 1, 'text', p ->> 'right') ORDER BY random())
             FROM jsonb_array_elements(q.options -> 'pairs') WITH ORDINALITY AS pr(p, ord)),
          '[]'::jsonb
        )
        ELSE NULL
      END AS pairs_right,
      CASE
        WHEN q.type = 'fill_blank' AND jsonb_typeof(q.options -> 'blanks') = 'array'
          THEN jsonb_array_length(q.options -> 'blanks')
        ELSE NULL
      END AS blank_count
    FROM qb_questions q
    WHERE q.tenant = p_tenant
      AND q.status = 'active'
      AND q.type <> 'open_ended'
      AND q.subject_id = p_subject_id
      AND (p_category_id IS NULL OR q.category_id = p_category_id)
      AND NOT EXISTS (
        SELECT 1 FROM game_quiz_category_settings cs
        WHERE cs.tenant = p_tenant AND cs.subject_id = p_subject_id
          AND cs.category_id = q.category_id AND cs.is_hidden
      )
    ORDER BY random()
    LIMIT v_take
  ) sub;

  RETURN jsonb_build_object(
    'ok', true,
    'attempt_id', gen_random_uuid(),
    'subject_id', p_subject_id,
    'category_id', p_category_id,
    'question_count', v_take,
    'questions', COALESCE(v_questions, '[]'::jsonb)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION start_quiz(TEXT, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION start_quiz(TEXT, UUID, UUID) TO authenticated;


-- ── 6a. admin_get_quiz_config ─────────────────────────────────
-- Todas las materias del tenant (también sin preguntas) con su config y sus
-- categorías (las que tienen preguntas jugables en esa materia).
CREATE OR REPLACE FUNCTION admin_get_quiz_config(p_tenant TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_current_user_rol() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'question_count', COALESCE(qc.n, 0),
        'settings', jsonb_build_object(
          'icon_key', ss.icon_key,
          'icon_image_path', ss.icon_image_path,
          'color_key', ss.color_key,
          'description', ss.description,
          'is_hidden', COALESCE(ss.is_hidden, false),
          'sort_order', ss.sort_order,
          'quiz_question_count', ss.quiz_question_count
        ),
        'categories', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', c.id,
              'name', c.name,
              'question_count', c.n,
              'settings', jsonb_build_object(
                'icon_key', cs.icon_key,
                'icon_image_path', cs.icon_image_path,
                'color_key', cs.color_key,
                'description', cs.description,
                'is_hidden', COALESCE(cs.is_hidden, false),
                'sort_order', cs.sort_order
              )
            ) ORDER BY cs.sort_order ASC NULLS LAST, c.name
          )
          FROM (
            SELECT cat.id, cat.name, count(q.id)::int AS n
            FROM qb_categories cat
            JOIN qb_questions q
              ON q.category_id = cat.id AND q.tenant = p_tenant
             AND q.status = 'active' AND q.type <> 'open_ended' AND q.subject_id = s.id
            WHERE cat.tenant = p_tenant
            GROUP BY cat.id, cat.name
          ) c
          LEFT JOIN game_quiz_category_settings cs
            ON cs.tenant = p_tenant AND cs.subject_id = s.id AND cs.category_id = c.id
        ), '[]'::jsonb)
      ) ORDER BY ss.sort_order ASC NULLS LAST, s.name
    )
    FROM qb_subjects s
    LEFT JOIN game_quiz_subject_settings ss ON ss.tenant = p_tenant AND ss.subject_id = s.id
    LEFT JOIN (
      SELECT subject_id, count(*)::int AS n
      FROM qb_questions
      WHERE tenant = p_tenant AND status = 'active' AND type <> 'open_ended'
      GROUP BY subject_id
    ) qc ON qc.subject_id = s.id
    WHERE s.tenant = p_tenant
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION admin_get_quiz_config(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_get_quiz_config(TEXT) TO authenticated;


-- ── 6b. admin_save_quiz_item ──────────────────────────────────
-- Upsert parcial: sólo cambia las claves presentes en p_patch. Devuelve la
-- imagen anterior (para borrarla del bucket si cambió) y la config completa.
CREATE OR REPLACE FUNCTION admin_save_quiz_item(
  p_tenant      TEXT,
  p_subject_id  UUID,
  p_category_id UUID,
  p_patch       JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev_image TEXT;
BEGIN
  IF get_current_user_rol() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM qb_subjects WHERE id = p_subject_id AND tenant = p_tenant) THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND');
  END IF;

  IF p_category_id IS NULL THEN
    SELECT icon_image_path INTO v_prev_image
    FROM game_quiz_subject_settings WHERE tenant = p_tenant AND subject_id = p_subject_id;

    INSERT INTO game_quiz_subject_settings (tenant, subject_id) VALUES (p_tenant, p_subject_id)
    ON CONFLICT (tenant, subject_id) DO NOTHING;

    UPDATE game_quiz_subject_settings SET
      icon_key        = CASE WHEN p_patch ? 'icon_key' THEN p_patch ->> 'icon_key' ELSE icon_key END,
      icon_image_path = CASE WHEN p_patch ? 'icon_image_path' THEN p_patch ->> 'icon_image_path' ELSE icon_image_path END,
      color_key       = CASE WHEN p_patch ? 'color_key' THEN p_patch ->> 'color_key' ELSE color_key END,
      description     = CASE WHEN p_patch ? 'description' THEN NULLIF(btrim(p_patch ->> 'description'), '') ELSE description END,
      is_hidden       = CASE WHEN p_patch ? 'is_hidden' THEN COALESCE((p_patch ->> 'is_hidden')::boolean, false) ELSE is_hidden END,
      quiz_question_count = CASE WHEN p_patch ? 'quiz_question_count' THEN (p_patch ->> 'quiz_question_count')::int ELSE quiz_question_count END
    WHERE tenant = p_tenant AND subject_id = p_subject_id;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM qb_categories WHERE id = p_category_id AND tenant = p_tenant) THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND');
    END IF;

    SELECT icon_image_path INTO v_prev_image
    FROM game_quiz_category_settings
    WHERE tenant = p_tenant AND subject_id = p_subject_id AND category_id = p_category_id;

    INSERT INTO game_quiz_category_settings (tenant, subject_id, category_id)
    VALUES (p_tenant, p_subject_id, p_category_id)
    ON CONFLICT (tenant, subject_id, category_id) DO NOTHING;

    UPDATE game_quiz_category_settings SET
      icon_key        = CASE WHEN p_patch ? 'icon_key' THEN p_patch ->> 'icon_key' ELSE icon_key END,
      icon_image_path = CASE WHEN p_patch ? 'icon_image_path' THEN p_patch ->> 'icon_image_path' ELSE icon_image_path END,
      color_key       = CASE WHEN p_patch ? 'color_key' THEN p_patch ->> 'color_key' ELSE color_key END,
      description     = CASE WHEN p_patch ? 'description' THEN NULLIF(btrim(p_patch ->> 'description'), '') ELSE description END,
      is_hidden       = CASE WHEN p_patch ? 'is_hidden' THEN COALESCE((p_patch ->> 'is_hidden')::boolean, false) ELSE is_hidden END
    WHERE tenant = p_tenant AND subject_id = p_subject_id AND category_id = p_category_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'previous_icon_image_path', v_prev_image,
    'config', admin_get_quiz_config(p_tenant)
  );
END;
$$;

REVOKE ALL ON FUNCTION admin_save_quiz_item(TEXT, UUID, UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_save_quiz_item(TEXT, UUID, UUID, JSONB) TO authenticated;


-- ── 6c. admin_reorder_quiz_items ──────────────────────────────
-- p_subject_id NULL → p_ids son materias; si no, categorías de esa materia.
CREATE OR REPLACE FUNCTION admin_reorder_quiz_items(
  p_tenant     TEXT,
  p_subject_id UUID,
  p_ids        UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_current_user_rol() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_subject_id IS NULL THEN
    INSERT INTO game_quiz_subject_settings (tenant, subject_id, sort_order)
    SELECT p_tenant, x.id, x.ord::int
    FROM unnest(p_ids) WITH ORDINALITY AS x(id, ord)
    JOIN qb_subjects s ON s.id = x.id AND s.tenant = p_tenant
    ON CONFLICT (tenant, subject_id) DO UPDATE SET sort_order = EXCLUDED.sort_order;
  ELSE
    INSERT INTO game_quiz_category_settings (tenant, subject_id, category_id, sort_order)
    SELECT p_tenant, p_subject_id, x.id, x.ord::int
    FROM unnest(p_ids) WITH ORDINALITY AS x(id, ord)
    JOIN qb_categories c ON c.id = x.id AND c.tenant = p_tenant
    ON CONFLICT (tenant, subject_id, category_id) DO UPDATE SET sort_order = EXCLUDED.sort_order;
  END IF;

  RETURN jsonb_build_object('ok', true, 'config', admin_get_quiz_config(p_tenant));
END;
$$;

REVOKE ALL ON FUNCTION admin_reorder_quiz_items(TEXT, UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_reorder_quiz_items(TEXT, UUID, UUID[]) TO authenticated;


-- ── 6d. get_game_admin_bootstrap (+ quiz_config) ──────────────
CREATE OR REPLACE FUNCTION get_game_admin_bootstrap(p_tenant TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_current_user_rol() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'settings', (SELECT to_jsonb(gs.*) FROM game_settings gs WHERE gs.tenant = p_tenant),
    'point_sources', COALESCE((
      SELECT jsonb_agg(to_jsonb(ps.*) ORDER BY ps.action_type)
      FROM game_point_sources ps WHERE ps.tenant = p_tenant), '[]'::jsonb),
    'streak_thresholds', COALESCE((
      SELECT jsonb_agg(to_jsonb(st.*) ORDER BY st.days)
      FROM game_streak_thresholds st WHERE st.tenant = p_tenant), '[]'::jsonb),
    'levels', COALESCE((
      SELECT jsonb_agg(to_jsonb(lt.*) ORDER BY lt.level)
      FROM game_level_thresholds lt WHERE lt.tenant = p_tenant), '[]'::jsonb),
    'challenges', COALESCE((
      SELECT jsonb_agg(to_jsonb(ch.*) ORDER BY ch.created_at DESC)
      FROM game_challenges ch WHERE ch.tenant = p_tenant), '[]'::jsonb),
    'weekly_cases', COALESCE((
      SELECT jsonb_agg(to_jsonb(wc.*) ORDER BY wc.window_start DESC)
      FROM game_weekly_cases wc WHERE wc.tenant = p_tenant), '[]'::jsonb),
    'score_reset_log', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', l.id, 'executed_by', l.executed_by,
               'executed_at', l.executed_at, 'reset_scope', l.reset_scope)
             ORDER BY l.executed_at DESC)
      FROM (
        SELECT * FROM game_score_reset_log
        WHERE tenant = p_tenant ORDER BY executed_at DESC LIMIT 20
      ) l), '[]'::jsonb),
    'badges', admin_list_game_badges(p_tenant),
    'daily_questions', admin_list_daily_questions(p_tenant, NULL, NULL),
    'players', COALESCE(list_game_players(p_tenant, '') -> 'players', '[]'::jsonb),
    'stats', get_game_stats(p_tenant),
    'quiz_config', admin_get_quiz_config(p_tenant)
  );
END;
$$;
