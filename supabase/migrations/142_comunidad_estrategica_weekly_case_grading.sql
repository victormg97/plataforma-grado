-- 142_comunidad_estrategica_weekly_case_grading.sql
--
-- Weekly-case answer review & grading (admin).
--
-- 1) Persist grading detail on game_weekly_case_answers (feedback, graded_at,
--    points_awarded). quality_score + graded_by already exist.
-- 2) Index to count/list pending (ungraded) answers efficiently at scale.
-- 3) build_weekly_case_payload: surface the grade + feedback to the player.
-- 4) grade_weekly_case_answer: admin sets score/points/feedback; awards manual
--    XP via a deterministic point event (idempotent on re-grade).
-- 5) list_weekly_case_answers: paginated review list (by case / by user / by
--    status), joined with player identity.
-- 6) get_weekly_case_pending_counts: totals + per-case + per-user pending
--    counts for the review badges.

-- ── 1. Columns ─────────────────────────────────────────────────────────────────
ALTER TABLE game_weekly_case_answers
  ADD COLUMN IF NOT EXISTS feedback        TEXT,
  ADD COLUMN IF NOT EXISTS graded_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS points_awarded  INTEGER;

-- Pending = not yet graded (graded_at IS NULL). Partial index keeps the
-- pending scans/counts fast even with a large history.
CREATE INDEX IF NOT EXISTS idx_game_weekly_case_answers_pending
  ON game_weekly_case_answers (tenant, case_id)
  WHERE graded_at IS NULL;

-- ── 2. build_weekly_case_payload: include the grade in my_answer ───────────────
CREATE OR REPLACE FUNCTION build_weekly_case_payload(p_tenant TEXT, p_case_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     UUID := auth.uid();
  v_case        game_weekly_cases%ROWTYPE;
  v_status      game_weekly_case_status;
  v_answer      game_weekly_case_answers%ROWTYPE;
  v_has_answer  BOOLEAN := false;
  v_can_see_res BOOLEAN := false;
BEGIN
  SELECT * INTO v_case FROM game_weekly_cases
  WHERE tenant = p_tenant AND id = p_case_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_case.status = 'draft' AND get_current_user_rol() <> 'admin' THEN
    RETURN NULL;
  END IF;

  v_status := derive_weekly_case_status(v_case.status, v_case.window_start, v_case.window_end);
  IF v_status = 'closed' AND v_case.status = 'open' THEN
    UPDATE game_weekly_cases SET status = 'closed'
    WHERE id = v_case.id AND status = 'open';
    v_case.status := 'closed';
  END IF;

  SELECT * INTO v_answer FROM game_weekly_case_answers
  WHERE tenant = p_tenant AND case_id = p_case_id AND user_id = v_user_id;
  v_has_answer := FOUND;

  IF v_case.resolution_published THEN
    IF v_case.resolution_visibility = 'all_users' THEN
      v_can_see_res := true;
    ELSE
      v_can_see_res := v_has_answer;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'case', jsonb_build_object(
      'id', v_case.id,
      'title', v_case.title,
      'content', v_case.content,
      'window_start', v_case.window_start,
      'window_end', v_case.window_end,
      'status', v_status,
      'resolution_visibility', v_case.resolution_visibility
    ),
    'my_answer', CASE WHEN v_has_answer THEN jsonb_build_object(
      'answer_content', v_answer.answer_content,
      'submitted_at', v_answer.submitted_at,
      'updated_at', v_answer.updated_at,
      'graded', v_answer.graded_at IS NOT NULL,
      'graded_at', v_answer.graded_at,
      'quality_score', v_answer.quality_score,
      'points_awarded', v_answer.points_awarded,
      'feedback', v_answer.feedback
    ) ELSE NULL END,
    'resolution', jsonb_build_object(
      'published', v_case.resolution_published,
      'visible', v_can_see_res,
      'locked', v_case.resolution_published AND NOT v_can_see_res,
      'content', CASE WHEN v_can_see_res THEN v_case.resolution_content ELSE NULL END
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION build_weekly_case_payload(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION build_weekly_case_payload(TEXT, UUID) TO authenticated;

-- ── 3. grade_weekly_case_answer ────────────────────────────────────────────────
-- Admin grades one answer: sets quality_score (0..5, nullable), a free-text
-- feedback, and optional manual XP (points_awarded). Marks graded_by/graded_at.
-- Manual XP is recorded as a deterministic weekly_case_participated event
-- (source_ref = 'wc_grade:<case>:<user>') so it counts in the ranking and can
-- be safely re-applied when the grade changes (idempotent upsert-by-delete).
CREATE OR REPLACE FUNCTION grade_weekly_case_answer(
  p_tenant         TEXT,
  p_case_id        UUID,
  p_user_id        UUID,
  p_quality_score  INTEGER DEFAULT NULL,
  p_points         INTEGER DEFAULT 0,
  p_feedback       TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin   UUID := auth.uid();
  v_ref     TEXT := 'wc_grade:' || p_case_id::text || ':' || p_user_id::text;
  v_points  INTEGER := GREATEST(COALESCE(p_points, 0), 0);
  v_today   DATE := (timezone('America/Santiago', now()))::date;
  v_exists  BOOLEAN;
BEGIN
  IF v_admin IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'UNAUTHENTICATED');
  END IF;
  IF get_current_user_rol() <> 'admin' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM game_weekly_case_answers
    WHERE tenant = p_tenant AND case_id = p_case_id AND user_id = p_user_id
  ) INTO v_exists;
  IF NOT v_exists THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'ANSWER_NOT_FOUND');
  END IF;

  UPDATE game_weekly_case_answers
  SET quality_score  = p_quality_score,
      points_awarded = v_points,
      feedback       = NULLIF(btrim(COALESCE(p_feedback, '')), ''),
      graded_by      = v_admin,
      graded_at      = now()
  WHERE tenant = p_tenant AND case_id = p_case_id AND user_id = p_user_id;

  -- Re-apply the manual XP idempotently: remove any prior grade event, then
  -- insert the new one when points > 0.
  DELETE FROM game_point_events
  WHERE tenant = p_tenant
    AND user_id = p_user_id
    AND action_type = 'weekly_case_participated'
    AND source_ref = v_ref;

  IF v_points > 0 THEN
    INSERT INTO game_point_events (tenant, user_id, action_type, points_awarded, source_ref, occurred_date)
    VALUES (p_tenant, p_user_id, 'weekly_case_participated', v_points, v_ref, v_today);
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION grade_weekly_case_answer(TEXT, UUID, UUID, INTEGER, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION grade_weekly_case_answer(TEXT, UUID, UUID, INTEGER, INTEGER, TEXT) TO authenticated;

-- ── 4. list_weekly_case_answers ────────────────────────────────────────────────
-- Paginated review list. Filters: case_id (optional), user_id (optional),
-- status ('pending' | 'graded' | NULL=all). Joined with player identity.
CREATE OR REPLACE FUNCTION list_weekly_case_answers(
  p_tenant    TEXT,
  p_case_id   UUID    DEFAULT NULL,
  p_user_id   UUID    DEFAULT NULL,
  p_status    TEXT    DEFAULT NULL,
  p_page      INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page      INTEGER := GREATEST(COALESCE(p_page, 1), 1);
  v_size      INTEGER := LEAST(GREATEST(COALESCE(p_page_size, 10), 1), 50);
  v_offset    INTEGER;
  v_total     INTEGER;
  v_rows      JSONB;
BEGIN
  IF get_current_user_rol() <> 'admin' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  v_offset := (v_page - 1) * v_size;

  SELECT count(*) INTO v_total
  FROM game_weekly_case_answers a
  WHERE a.tenant = p_tenant
    AND (p_case_id IS NULL OR a.case_id = p_case_id)
    AND (p_user_id IS NULL OR a.user_id = p_user_id)
    AND (
      p_status IS NULL
      OR (p_status = 'pending' AND a.graded_at IS NULL)
      OR (p_status = 'graded'  AND a.graded_at IS NOT NULL)
    );

  SELECT COALESCE(jsonb_agg(row_to_json(r)), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT
      a.case_id,
      a.user_id,
      c.title            AS case_title,
      a.answer_content,
      a.submitted_at,
      a.updated_at,
      a.quality_score,
      a.points_awarded,
      a.feedback,
      a.graded_at,
      (a.graded_at IS NOT NULL) AS graded,
      gp.nickname,
      p.nombre,
      p.apellido,
      p.email
    FROM game_weekly_case_answers a
    JOIN game_weekly_cases c ON c.id = a.case_id AND c.tenant = a.tenant
    LEFT JOIN profiles p ON p.id = a.user_id
    LEFT JOIN game_profiles gp ON gp.user_id = a.user_id AND gp.tenant = a.tenant
    WHERE a.tenant = p_tenant
      AND (p_case_id IS NULL OR a.case_id = p_case_id)
      AND (p_user_id IS NULL OR a.user_id = p_user_id)
      AND (
        p_status IS NULL
        OR (p_status = 'pending' AND a.graded_at IS NULL)
        OR (p_status = 'graded'  AND a.graded_at IS NOT NULL)
      )
    ORDER BY (a.graded_at IS NULL) DESC, a.submitted_at DESC
    LIMIT v_size OFFSET v_offset
  ) r;

  RETURN jsonb_build_object(
    'data', v_rows,
    'page', v_page,
    'page_size', v_size,
    'total', v_total,
    'total_pages', GREATEST(CEIL(v_total::numeric / v_size)::int, 1)
  );
END;
$$;

REVOKE ALL ON FUNCTION list_weekly_case_answers(TEXT, UUID, UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_weekly_case_answers(TEXT, UUID, UUID, TEXT, INTEGER, INTEGER) TO authenticated;

-- ── 5. get_weekly_case_pending_counts ──────────────────────────────────────────
-- Pending (ungraded) counts for the review badges: total, per case, per user.
CREATE OR REPLACE FUNCTION get_weekly_case_pending_counts(p_tenant TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total   INTEGER;
  v_by_case JSONB;
  v_by_user JSONB;
BEGIN
  IF get_current_user_rol() <> 'admin' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_total
  FROM game_weekly_case_answers
  WHERE tenant = p_tenant AND graded_at IS NULL;

  SELECT COALESCE(jsonb_object_agg(case_id::text, n), '{}'::jsonb) INTO v_by_case
  FROM (
    SELECT case_id, count(*) AS n
    FROM game_weekly_case_answers
    WHERE tenant = p_tenant AND graded_at IS NULL
    GROUP BY case_id
  ) s;

  SELECT COALESCE(jsonb_object_agg(user_id::text, n), '{}'::jsonb) INTO v_by_user
  FROM (
    SELECT user_id, count(*) AS n
    FROM game_weekly_case_answers
    WHERE tenant = p_tenant AND graded_at IS NULL
    GROUP BY user_id
  ) s;

  RETURN jsonb_build_object('total', v_total, 'by_case', v_by_case, 'by_user', v_by_user);
END;
$$;

REVOKE ALL ON FUNCTION get_weekly_case_pending_counts(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_weekly_case_pending_counts(TEXT) TO authenticated;
