-- ============================================================
-- Migration 149: Comunidad Estratégica — Catálogo de cuestionarios,
-- precarga de categorías y datos para Racha / Desafíos
-- ============================================================
--   1. admin_get_quiz_config: categorías de una materia = las que tienen
--      preguntas en ella + las vinculadas a mano (fila en
--      game_quiz_category_settings). Agrega total_question_count (todas las
--      preguntas, cualquier estado/tipo) para decidir si se puede eliminar.
--   2. admin_manage_quiz_catalog(action, args): crear/renombrar/eliminar
--      materias y crear/vincular/renombrar/quitar categorías, desde la pestaña
--      Cuestionarios. Nunca borra algo que tenga preguntas.
--   3. get_all_quiz_categories + parte 'quiz_categories' en get_game_state:
--      las categorías de TODAS las materias visibles vienen en el bootstrap
--      (antes: 1 request al abrir cada materia por primera vez).
--      game_submit_quiz refresca materias/categorías (contador "jugado").
--   4. get_game_profile: streak_milestones (hitos de racha del tenant).
--   5. get_active_challenges: period_start / period_end (tiempo restante).
-- ============================================================


-- ── 1. admin_get_quiz_config ──────────────────────────────────
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
        'question_count', COALESCE(qc.playable, 0),
        'total_question_count', COALESCE(qc.total, 0),
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
              'question_count', c.playable,
              'total_question_count', c.total,
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
            SELECT cat.id, cat.name,
              count(q.id) FILTER (WHERE q.status = 'active' AND q.type <> 'open_ended')::int AS playable,
              count(q.id)::int AS total
            FROM qb_categories cat
            LEFT JOIN qb_questions q
              ON q.category_id = cat.id AND q.tenant = p_tenant AND q.subject_id = s.id
            WHERE cat.tenant = p_tenant
              AND (
                q.id IS NOT NULL
                OR EXISTS (
                  SELECT 1 FROM game_quiz_category_settings l
                  WHERE l.tenant = p_tenant AND l.subject_id = s.id AND l.category_id = cat.id
                )
              )
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
      SELECT subject_id,
        count(*) FILTER (WHERE status = 'active' AND type <> 'open_ended')::int AS playable,
        count(*)::int AS total
      FROM qb_questions
      WHERE tenant = p_tenant
      GROUP BY subject_id
    ) qc ON qc.subject_id = s.id
    WHERE s.tenant = p_tenant
  ), '[]'::jsonb);
END;
$$;


-- ── 2. admin_manage_quiz_catalog ──────────────────────────────
-- Acciones:
--   create_subject   {name}
--   rename_subject   {subject_id, name}
--   delete_subject   {subject_id}                 (sólo sin preguntas)
--   add_category     {subject_id, category_id? | name?}  vincula existente o crea
--   rename_category  {category_id, name}           (renombra en el banco)
--   remove_category  {subject_id, category_id}     (sólo sin preguntas en la
--                    materia; si queda sin uso en todo el banco, se elimina)
-- Devuelve {ok, error_code?, count?, id?, config}.
CREATE OR REPLACE FUNCTION admin_manage_quiz_catalog(p_tenant TEXT, p_action TEXT, p_args JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name    TEXT := NULLIF(btrim(COALESCE(p_args ->> 'name', '')), '');
  v_subject UUID := NULLIF(p_args ->> 'subject_id', '')::uuid;
  v_cat     UUID := NULLIF(p_args ->> 'category_id', '')::uuid;
  v_count   INTEGER;
  v_id      UUID;
BEGIN
  IF get_current_user_rol() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_name IS NOT NULL AND char_length(v_name) > 120 THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NAME_TOO_LONG');
  END IF;

  IF p_action IN ('rename_subject', 'delete_subject', 'add_category', 'remove_category')
     AND NOT EXISTS (SELECT 1 FROM qb_subjects WHERE id = v_subject AND tenant = p_tenant) THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND');
  END IF;

  IF p_action = 'create_subject' THEN
    IF v_name IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NAME_REQUIRED'); END IF;
    IF EXISTS (SELECT 1 FROM qb_subjects WHERE tenant = p_tenant AND lower(name) = lower(v_name)) THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'DUPLICATE');
    END IF;
    INSERT INTO qb_subjects (tenant, name, keywords) VALUES (p_tenant, v_name, '{}') RETURNING id INTO v_id;

  ELSIF p_action = 'rename_subject' THEN
    IF v_name IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NAME_REQUIRED'); END IF;
    IF EXISTS (SELECT 1 FROM qb_subjects WHERE tenant = p_tenant AND lower(name) = lower(v_name) AND id <> v_subject) THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'DUPLICATE');
    END IF;
    UPDATE qb_subjects SET name = v_name WHERE id = v_subject AND tenant = p_tenant;
    v_id := v_subject;

  ELSIF p_action = 'delete_subject' THEN
    SELECT count(*) INTO v_count FROM qb_questions WHERE tenant = p_tenant AND subject_id = v_subject;
    IF v_count > 0 THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'HAS_QUESTIONS', 'count', v_count);
    END IF;
    -- Settings rows cascade.
    DELETE FROM qb_subjects WHERE id = v_subject AND tenant = p_tenant;

  ELSIF p_action = 'add_category' THEN
    IF v_cat IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM qb_categories WHERE id = v_cat AND tenant = p_tenant) THEN
        RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND');
      END IF;
    ELSE
      IF v_name IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NAME_REQUIRED'); END IF;
      -- Reuse a bank category with the same name instead of duplicating it.
      SELECT id INTO v_cat FROM qb_categories WHERE tenant = p_tenant AND lower(name) = lower(v_name);
      IF v_cat IS NULL THEN
        INSERT INTO qb_categories (tenant, name, keywords) VALUES (p_tenant, v_name, '{}') RETURNING id INTO v_cat;
      END IF;
    END IF;
    INSERT INTO game_quiz_category_settings (tenant, subject_id, category_id)
    VALUES (p_tenant, v_subject, v_cat)
    ON CONFLICT (tenant, subject_id, category_id) DO NOTHING;
    v_id := v_cat;

  ELSIF p_action = 'rename_category' THEN
    IF v_name IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NAME_REQUIRED'); END IF;
    IF NOT EXISTS (SELECT 1 FROM qb_categories WHERE id = v_cat AND tenant = p_tenant) THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND');
    END IF;
    IF EXISTS (SELECT 1 FROM qb_categories WHERE tenant = p_tenant AND lower(name) = lower(v_name) AND id <> v_cat) THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'DUPLICATE');
    END IF;
    UPDATE qb_categories SET name = v_name WHERE id = v_cat AND tenant = p_tenant;
    v_id := v_cat;

  ELSIF p_action = 'remove_category' THEN
    SELECT count(*) INTO v_count FROM qb_questions
    WHERE tenant = p_tenant AND subject_id = v_subject AND category_id = v_cat;
    IF v_count > 0 THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'HAS_QUESTIONS', 'count', v_count);
    END IF;
    DELETE FROM game_quiz_category_settings
    WHERE tenant = p_tenant AND subject_id = v_subject AND category_id = v_cat;
    -- Unused anywhere in the bank (no questions, no other links): delete it.
    IF NOT EXISTS (SELECT 1 FROM qb_questions WHERE tenant = p_tenant AND category_id = v_cat)
       AND NOT EXISTS (SELECT 1 FROM game_quiz_category_settings WHERE tenant = p_tenant AND category_id = v_cat) THEN
      DELETE FROM qb_categories WHERE id = v_cat AND tenant = p_tenant;
    END IF;

  ELSE
    RETURN jsonb_build_object('ok', false, 'error_code', 'UNKNOWN_ACTION');
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'config', admin_get_quiz_config(p_tenant));
END;
$$;

REVOKE ALL ON FUNCTION admin_manage_quiz_catalog(TEXT, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_manage_quiz_catalog(TEXT, TEXT, JSONB) TO authenticated;


-- ── 3a. get_all_quiz_categories ───────────────────────────────
-- { "<subject_id>": { "categories": [...] }, ... } para cada materia visible
-- con preguntas jugables (misma forma que get_quiz_categories).
CREATE OR REPLACE FUNCTION get_all_quiz_categories(p_tenant TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_object_agg(s.subject_id::text, get_quiz_categories(p_tenant, s.subject_id))
    FROM (
      SELECT DISTINCT q.subject_id
      FROM qb_questions q
      WHERE q.tenant = p_tenant AND q.status = 'active' AND q.type <> 'open_ended'
        AND q.subject_id IS NOT NULL
    ) s
    WHERE NOT EXISTS (
      SELECT 1 FROM game_quiz_subject_settings ss
      WHERE ss.tenant = p_tenant AND ss.subject_id = s.subject_id AND ss.is_hidden
    )
  ), '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION get_all_quiz_categories(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_all_quiz_categories(TEXT) TO authenticated;


-- ── 3b. get_game_state (+ quiz_categories) ────────────────────
CREATE OR REPLACE FUNCTION get_game_state(p_tenant TEXT, p_parts TEXT[] DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_all    BOOLEAN := p_parts IS NULL;
  v_result JSONB := '{}'::jsonb;
BEGIN
  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_all OR 'settings' = ANY (p_parts) THEN
    v_result := v_result || jsonb_build_object('settings',
      (SELECT to_jsonb(gs.*) FROM game_settings gs WHERE gs.tenant = p_tenant));
  END IF;
  IF v_all OR 'profile' = ANY (p_parts) THEN
    v_result := v_result || jsonb_build_object('profile', get_game_profile(p_tenant));
  END IF;
  IF v_all OR 'daily_question' = ANY (p_parts) THEN
    v_result := v_result || jsonb_build_object('daily_question', get_daily_question_state(p_tenant));
  END IF;
  IF v_all OR 'daily_review' = ANY (p_parts) THEN
    v_result := v_result || jsonb_build_object('daily_review', get_daily_review(p_tenant));
  END IF;
  IF v_all OR 'quiz_subjects' = ANY (p_parts) THEN
    v_result := v_result || jsonb_build_object('quiz_subjects', get_quiz_subjects(p_tenant));
  END IF;
  IF v_all OR 'quiz_categories' = ANY (p_parts) THEN
    v_result := v_result || jsonb_build_object('quiz_categories', get_all_quiz_categories(p_tenant));
  END IF;
  IF v_all OR 'ranking' = ANY (p_parts) THEN
    v_result := v_result || jsonb_build_object('ranking', get_ranking_page(p_tenant, NULL, 20, 0));
  END IF;
  IF v_all OR 'challenges' = ANY (p_parts) THEN
    v_result := v_result || jsonb_build_object('challenges', get_active_challenges(p_tenant));
  END IF;
  IF v_all OR 'badges' = ANY (p_parts) THEN
    v_result := v_result || jsonb_build_object('badges', get_user_badges(p_tenant));
  END IF;
  IF v_all OR 'weekly_case' = ANY (p_parts) THEN
    v_result := v_result || jsonb_build_object('weekly_case', get_current_weekly_case(p_tenant));
  END IF;

  RETURN v_result;
END;
$$;


-- ── 3c. game_submit_quiz: refresca también materias/categorías ─
CREATE OR REPLACE FUNCTION game_submit_quiz(
  p_tenant TEXT,
  p_subject_id UUID,
  p_category_id UUID,
  p_answers JSONB,
  p_attempt_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res JSONB;
BEGIN
  v_res := submit_quiz(p_tenant, p_subject_id, p_category_id, p_answers, p_attempt_id);
  IF COALESCE((v_res ->> 'ok')::boolean, false) THEN
    v_res := v_res || jsonb_build_object('state', get_game_state(p_tenant,
      ARRAY['profile', 'badges', 'challenges', 'ranking', 'quiz_subjects', 'quiz_categories']));
  END IF;
  RETURN v_res;
END;
$$;


-- ── 4. get_game_profile (+ streak_milestones) ─────────────────
CREATE OR REPLACE FUNCTION get_game_profile(p_tenant TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  UUID := auth.uid();
  v_today    DATE := (timezone('America/Santiago', now()))::date;
  v_prof     game_profiles%ROWTYPE;
  v_lives    INTEGER; v_lmax INTEGER; v_lenabled BOOLEAN; v_next TIMESTAMPTZ;
  v_block    BOOLEAN;
  v_costs    BOOLEAN;
  v_level    INTEGER; v_xp INTEGER; v_cur_min INTEGER; v_next_min INTEGER;
  v_recent   JSONB;
  v_stored   INTEGER;
  v_current  INTEGER;
  v_broken   BOOLEAN;
  v_status   TEXT;
  v_miles    JSONB;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Unauthenticated' USING ERRCODE = '42501'; END IF;
  IF NOT game_is_accessible(p_tenant) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501'; END IF;

  SELECT o_lives, o_max, o_enabled, o_next_regen INTO v_lives, v_lmax, v_lenabled, v_next
  FROM regen_and_get_lives(p_tenant, v_user_id);

  SELECT COALESCE(lives_block_when_empty, true) INTO v_block FROM game_settings WHERE tenant = p_tenant;

  SELECT EXISTS (
    SELECT 1 FROM game_point_sources
    WHERE tenant = p_tenant AND enabled AND costs_life
  ) INTO v_costs;

  SELECT COALESCE(jsonb_agg(days ORDER BY days), '[]'::jsonb) INTO v_miles
  FROM game_streak_thresholds WHERE tenant = p_tenant;

  SELECT * INTO v_prof FROM game_profiles WHERE tenant = p_tenant AND user_id = v_user_id;

  SELECT o_level, o_xp, o_current_min, o_next_min INTO v_level, v_xp, v_cur_min, v_next_min
  FROM compute_user_level(p_tenant, v_user_id);

  v_recent := get_recent_achievements(p_tenant, NULL);

  v_stored  := COALESCE(v_prof.current_streak, 0);
  v_current := game_effective_streak(v_stored, v_prof.last_activity_date, v_today);
  v_broken  := v_stored > 0 AND v_current = 0;

  v_status := CASE
    WHEN v_broken THEN 'broken'
    WHEN v_current > 0 AND v_prof.last_activity_date = v_today THEN 'active'
    WHEN v_current > 0 THEN 'at_risk'
    ELSE 'none'
  END;

  RETURN jsonb_build_object(
    'nickname', v_prof.nickname,
    'current_streak', v_current,
    'longest_streak', COALESCE(v_prof.longest_streak, 0),
    'previous_streak', CASE WHEN v_broken THEN v_stored ELSE COALESCE(v_prof.previous_streak, 0) END,
    'streak_status', v_status,
    'streak_milestones', v_miles,
    'last_activity_date', v_prof.last_activity_date,
    'nickname_updated_at', v_prof.nickname_updated_at,
    'lives', jsonb_build_object(
      'enabled', v_lenabled, 'current', v_lives, 'max', v_lmax, 'next_regen', v_next,
      'block_when_empty', COALESCE(v_block, true),
      'costs_on_mistake', COALESCE(v_costs, false)
    ),
    'level', jsonb_build_object('level', v_level, 'xp', v_xp, 'current_min', v_cur_min, 'next_min', v_next_min),
    'moderation', jsonb_build_object('is_restricted', COALESCE(v_prof.is_restricted, false), 'is_banned', COALESCE(v_prof.is_banned, false), 'ban_reason', v_prof.ban_reason),
    'recent_achievements', COALESCE(v_recent -> 'achievements', '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION get_game_profile(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_game_profile(TEXT) TO authenticated;


-- ── 5. get_active_challenges (+ período) ──────────────────────
CREATE OR REPLACE FUNCTION get_active_challenges(p_tenant TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_now     TIMESTAMPTZ := now();
  v_result  JSONB;
BEGIN
  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'title', c.title,
      'description', c.description,
      'period_type', c.period_type,
      'period_start', b.o_start,
      'period_end', b.o_end,
      'target_count', (c.criteria ->> 'count')::int,
      'progress_count', CASE
        WHEN pr.period_start IS NOT DISTINCT FROM b.o_start THEN COALESCE(pr.progress_count, 0)
        ELSE 0
      END,
      'completed', CASE
        WHEN pr.period_start IS NOT DISTINCT FROM b.o_start THEN pr.completed_at IS NOT NULL
        ELSE false
      END
    ) ORDER BY c.created_at DESC
  ), '[]'::jsonb)
  INTO v_result
  FROM game_challenges c
  CROSS JOIN LATERAL challenge_period_bounds(c.period_type, c.starts_at, c.ends_at, v_now) b
  LEFT JOIN game_challenge_progress pr
    ON pr.challenge_id = c.id AND pr.tenant = p_tenant AND pr.user_id = v_user_id
  WHERE c.tenant = p_tenant
    AND c.enabled = true
    AND b.o_start IS NOT NULL AND b.o_end IS NOT NULL
    AND v_now >= b.o_start AND v_now < b.o_end;

  RETURN jsonb_build_object('challenges', v_result);
END;
$$;
