-- Migration 130: Comunidad Estratégica (Slice 4) — Caso de la Semana
-- ============================================================
-- Creates:
--   1. Enums game_weekly_case_status (draft|open|closed|resolved)
--            game_resolution_visibility (participants_only|all_users)
--   2. game_weekly_cases         — case definitions (TipTap HTML + window)
--   3. game_weekly_case_answers  — one editable answer per user per case
--        (quality_score / graded_by reserved NULL for future grading)
--   4. Partial unique index for weekly_case_participated idempotency
--   5. derive_weekly_case_status() — lazy status by window (America/Santiago)
--   6. get_current_weekly_case / get_weekly_case_detail /
--      get_weekly_case_history — player reads (visibility-controlled)
--   7. submit_weekly_case_answer — upsert answer + emit weekly_case_participated
--        once per (user, case), then apply_streak + evaluate_challenges +
--        evaluate_badges within the same transaction (Slice 1-3 engines reused).
--   8. publish_weekly_case_resolution — admin publishes resolution (closed->resolved)
--
-- No new engines: this slice only EMITS the event; challenge/badge/streak
-- engines from Slices 1-3 are reused unchanged. Window close is LAZY
-- (derived/persisted on query, like select_daily_question). All boundaries
-- use America/Santiago.
-- ============================================================

-- ── 1. Enums ──────────────────────────────────────────────────

CREATE TYPE game_weekly_case_status    AS ENUM ('draft', 'open', 'closed', 'resolved');
CREATE TYPE game_resolution_visibility AS ENUM ('participants_only', 'all_users');


-- ── 2. game_weekly_cases ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS game_weekly_cases (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant                TEXT NOT NULL,
  title                 TEXT NOT NULL,
  content               TEXT NOT NULL,                       -- TipTap HTML (statement)
  window_start          TIMESTAMPTZ NOT NULL,
  window_end            TIMESTAMPTZ NOT NULL,
  status                game_weekly_case_status NOT NULL DEFAULT 'draft',
  resolution_content    TEXT NOT NULL DEFAULT '',            -- TipTap HTML; empty until published
  resolution_published  BOOLEAN NOT NULL DEFAULT false,
  resolution_visibility game_resolution_visibility NOT NULL DEFAULT 'participants_only',
  created_by            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Window end must be after start (Req. 1.4).
  CONSTRAINT game_weekly_cases_window_valid CHECK (window_end > window_start),
  -- A resolved case must have its resolution published (coherence).
  CONSTRAINT game_weekly_cases_resolved_published CHECK (
    status <> 'resolved' OR resolution_published
  )
);

CREATE INDEX idx_game_weekly_cases_tenant ON game_weekly_cases (tenant);
CREATE INDEX idx_game_weekly_cases_tenant_status ON game_weekly_cases (tenant, status);
CREATE INDEX idx_game_weekly_cases_tenant_window ON game_weekly_cases (tenant, window_start DESC);

CREATE TRIGGER game_weekly_cases_updated_at
  BEFORE UPDATE ON game_weekly_cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE game_weekly_cases ENABLE ROW LEVEL SECURITY;

-- Players with access can read non-draft cases; admin can read all (Req. 2.7 / 10.3).
CREATE POLICY "game_weekly_cases_select_accessible"
  ON game_weekly_cases FOR SELECT
  TO authenticated
  USING (
    game_is_accessible(tenant)
    AND (status <> 'draft' OR get_current_user_rol() = 'admin')
  );

-- No client INSERT/UPDATE/DELETE: admin CRUD via service role / admin API,
-- resolution via SECURITY DEFINER RPC.


-- ── 3. game_weekly_case_answers ───────────────────────────────

CREATE TABLE IF NOT EXISTS game_weekly_case_answers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant         TEXT NOT NULL,
  case_id        UUID NOT NULL REFERENCES game_weekly_cases(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  answer_content TEXT NOT NULL,                              -- TipTap HTML (answer)
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Reserved for future grading (Req. 9): always NULL in this slice.
  quality_score  INTEGER,
  graded_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One answer per user per case (Req. 4.1 / 4.3 / 8.4).
  CONSTRAINT game_weekly_case_answers_unique UNIQUE (tenant, case_id, user_id)
);

CREATE INDEX idx_game_weekly_case_answers_case ON game_weekly_case_answers (case_id);
CREATE INDEX idx_game_weekly_case_answers_user ON game_weekly_case_answers (tenant, user_id);

CREATE TRIGGER game_weekly_case_answers_updated_at
  BEFORE UPDATE ON game_weekly_case_answers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE game_weekly_case_answers ENABLE ROW LEVEL SECURITY;

-- Users read their own answer.
CREATE POLICY "game_weekly_case_answers_select_own"
  ON game_weekly_case_answers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admin reads all answers.
CREATE POLICY "game_weekly_case_answers_select_admin"
  ON game_weekly_case_answers FOR SELECT
  TO authenticated
  USING (get_current_user_rol() = 'admin');

-- No client INSERT/UPDATE: only the SECURITY DEFINER RPC writes answers.


-- ── 4. Idempotency index for weekly_case_participated ─────────
-- At most one participation event per user per case (Req. 8.3/8.4/8.5).
-- source_ref = case_id. Mirrors uq_game_point_events_daily (migration 120).
CREATE UNIQUE INDEX uq_game_point_events_weekly_case
  ON game_point_events (tenant, user_id, action_type, source_ref)
  WHERE action_type = 'weekly_case_participated';


-- ── 5. derive_weekly_case_status ──────────────────────────────
-- Effective status of a case at "now" (America/Santiago), without writing.
-- draft and resolved are stable; open/closed are derived from the window.
-- Before window_start the case is not yet open (returned as its stored status
-- if not open, otherwise 'open' is downgraded to the stored value).
CREATE OR REPLACE FUNCTION derive_weekly_case_status(
  p_status       game_weekly_case_status,
  p_window_start TIMESTAMPTZ,
  p_window_end   TIMESTAMPTZ
)
RETURNS game_weekly_case_status
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
BEGIN
  -- Terminal / manual states never auto-transition (Req. 2.5 / 2.7).
  IF p_status = 'draft' OR p_status = 'resolved' THEN
    RETURN p_status;
  END IF;

  -- Published case (open/closed): derive from the window.
  IF v_now < p_window_start THEN
    -- Not yet open: keep as its stored (non-open) baseline; treated as
    -- "not answerable" by callers (Req. 2.3).
    RETURN CASE WHEN p_status = 'open' THEN 'open' ELSE p_status END;
  ELSIF v_now < p_window_end THEN
    RETURN 'open';   -- within the window (Req. 2.2)
  ELSE
    RETURN 'closed'; -- window elapsed (Req. 2.4)
  END IF;
END;
$$;


-- ── 6. Player reads ───────────────────────────────────────────

-- Builds the visibility-aware JSON for a single case for the calling user.
-- Internal helper used by the read RPCs. Persists a lazy close if needed.
CREATE OR REPLACE FUNCTION build_weekly_case_payload(
  p_tenant  TEXT,
  p_case_id UUID
)
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
  v_now         TIMESTAMPTZ := now();
BEGIN
  SELECT * INTO v_case FROM game_weekly_cases
  WHERE tenant = p_tenant AND id = p_case_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Hide drafts from non-admins (Req. 2.7).
  IF v_case.status = 'draft' AND get_current_user_rol() <> 'admin' THEN
    RETURN NULL;
  END IF;

  -- Derive effective status; lazily persist 'closed' when the window elapsed.
  v_status := derive_weekly_case_status(v_case.status, v_case.window_start, v_case.window_end);
  IF v_status = 'closed' AND v_case.status = 'open' THEN
    UPDATE game_weekly_cases SET status = 'closed'
    WHERE id = v_case.id AND status = 'open';
    v_case.status := 'closed';
  END IF;

  -- Caller's own answer.
  SELECT * INTO v_answer FROM game_weekly_case_answers
  WHERE tenant = p_tenant AND case_id = p_case_id AND user_id = v_user_id;
  v_has_answer := FOUND;

  -- Resolution visibility (Req. 7).
  IF v_case.resolution_published THEN
    IF v_case.resolution_visibility = 'all_users' THEN
      v_can_see_res := true;
    ELSE
      v_can_see_res := v_has_answer;  -- participants_only
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
      'updated_at', v_answer.updated_at
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


-- Current (or latest visible) weekly case for the player.
CREATE OR REPLACE FUNCTION get_current_weekly_case(p_tenant TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now     TIMESTAMPTZ := now();
  v_case_id UUID;
BEGIN
  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- Prefer the case whose window contains "now"; else the most recent
  -- non-draft case (to show the last state).
  SELECT id INTO v_case_id
  FROM game_weekly_cases
  WHERE tenant = p_tenant
    AND status <> 'draft'
    AND v_now >= window_start AND v_now < window_end
  ORDER BY window_start DESC
  LIMIT 1;

  IF v_case_id IS NULL THEN
    SELECT id INTO v_case_id
    FROM game_weekly_cases
    WHERE tenant = p_tenant AND status <> 'draft'
    ORDER BY window_start DESC
    LIMIT 1;
  END IF;

  IF v_case_id IS NULL THEN
    RETURN jsonb_build_object('case', NULL);
  END IF;

  RETURN COALESCE(build_weekly_case_payload(p_tenant, v_case_id), jsonb_build_object('case', NULL));
END;
$$;

REVOKE ALL ON FUNCTION get_current_weekly_case(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_current_weekly_case(TEXT) TO authenticated;


-- Detail of a specific case (for opening one from the history).
CREATE OR REPLACE FUNCTION get_weekly_case_detail(p_tenant TEXT, p_case_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload JSONB;
BEGIN
  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  v_payload := build_weekly_case_payload(p_tenant, p_case_id);
  RETURN COALESCE(v_payload, jsonb_build_object('case', NULL));
END;
$$;

REVOKE ALL ON FUNCTION get_weekly_case_detail(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_weekly_case_detail(TEXT, UUID) TO authenticated;


-- Navigable history: closed/resolved cases, newest first (Req. 10).
CREATE OR REPLACE FUNCTION get_weekly_case_history(
  p_tenant TEXT,
  p_limit  INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_now     TIMESTAMPTZ := now();
  v_items   JSONB;
  v_total   BIGINT;
BEGIN
  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- Lazily close any elapsed open cases so the history reflects reality.
  UPDATE game_weekly_cases
  SET status = 'closed'
  WHERE tenant = p_tenant AND status = 'open' AND v_now >= window_end;

  SELECT count(*) INTO v_total
  FROM game_weekly_cases
  WHERE tenant = p_tenant AND status IN ('closed', 'resolved');

  SELECT COALESCE(jsonb_agg(item ORDER BY item_window_start DESC), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      c.window_start AS item_window_start,
      jsonb_build_object(
        'id', c.id,
        'title', c.title,
        'window_start', c.window_start,
        'window_end', c.window_end,
        'status', c.status,
        'resolution_published', c.resolution_published,
        'resolution_visibility', c.resolution_visibility,
        'i_answered', EXISTS (
          SELECT 1 FROM game_weekly_case_answers a
          WHERE a.tenant = p_tenant AND a.case_id = c.id AND a.user_id = v_user_id
        ),
        'resolution_visible', c.resolution_published AND (
          c.resolution_visibility = 'all_users'
          OR EXISTS (
            SELECT 1 FROM game_weekly_case_answers a
            WHERE a.tenant = p_tenant AND a.case_id = c.id AND a.user_id = v_user_id
          )
        )
      ) AS item
    FROM game_weekly_cases c
    WHERE c.tenant = p_tenant AND c.status IN ('closed', 'resolved')
    ORDER BY c.window_start DESC
    LIMIT p_limit OFFSET p_offset
  ) sub;

  RETURN jsonb_build_object(
    'total', v_total,
    'limit', p_limit,
    'offset', p_offset,
    'items', v_items
  );
END;
$$;

REVOKE ALL ON FUNCTION get_weekly_case_history(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_weekly_case_history(TEXT, INTEGER, INTEGER) TO authenticated;


-- ── 7. submit_weekly_case_answer ──────────────────────────────
-- Atomically: validates the open window, upserts the single answer, and on the
-- FIRST submission emits a weekly_case_participated event (points from
-- game_point_sources), then wires streak + challenges + badges within the same
-- transaction (mirrors submit_quiz). Points are granted once per (user, case),
-- independent of edits and of answer quality (Req. 8 / 9).
CREATE OR REPLACE FUNCTION submit_weekly_case_answer(
  p_tenant         TEXT,
  p_case_id        UUID,
  p_answer_content TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       UUID := auth.uid();
  v_today         DATE := (timezone('America/Santiago', now()))::date;
  v_now           TIMESTAMPTZ := now();
  v_case          game_weekly_cases%ROWTYPE;
  v_status        game_weekly_case_status;
  v_is_new        BOOLEAN := false;
  v_plain         TEXT;
  v_source        game_point_sources%ROWTYPE;
  v_points        INTEGER := 0;
  v_event_id      UUID;
  v_counts_streak BOOLEAN := false;
  v_new_current   INTEGER;
  v_new_longest   INTEGER;
  v_completed     JSONB := '[]'::jsonb;
  v_event_created BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'UNAUTHENTICATED');
  END IF;

  IF NOT game_is_accessible(p_tenant) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- Empty answer guard (Req. 3.3). Strip tags to detect content-less HTML.
  v_plain := btrim(regexp_replace(COALESCE(p_answer_content, ''), '<[^>]*>', '', 'g'));
  v_plain := btrim(replace(replace(v_plain, '&nbsp;', ''), E'\u00A0', ''));
  IF v_plain = '' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'EMPTY_ANSWER');
  END IF;

  -- Load and lock the case; lazily persist close if the window elapsed.
  SELECT * INTO v_case FROM game_weekly_cases
  WHERE tenant = p_tenant AND id = p_case_id
  FOR UPDATE;

  IF NOT FOUND OR v_case.status = 'draft' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'CASE_NOT_AVAILABLE');
  END IF;

  v_status := derive_weekly_case_status(v_case.status, v_case.window_start, v_case.window_end);
  IF v_status = 'closed' AND v_case.status = 'open' THEN
    UPDATE game_weekly_cases SET status = 'closed' WHERE id = v_case.id AND status = 'open';
    v_case.status := 'closed';
  END IF;

  -- Only an open case within its window accepts answers (Req. 3.4 / 5.1-5.4).
  IF v_status <> 'open' OR v_now >= v_case.window_end OR v_now < v_case.window_start THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'CASE_CLOSED');
  END IF;

  -- Upsert the single answer (Req. 3.1 / 4.1 / 4.2 / 4.3). xmax = 0 => inserted.
  INSERT INTO game_weekly_case_answers (
    tenant, case_id, user_id, answer_content, submitted_at, updated_at
  )
  VALUES (p_tenant, p_case_id, v_user_id, p_answer_content, now(), now())
  ON CONFLICT (tenant, case_id, user_id) DO UPDATE
    SET answer_content = EXCLUDED.answer_content,
        updated_at = now()
  RETURNING (xmax = 0) INTO v_is_new;

  -- Points on the FIRST submission only (Req. 8.1 / 8.3 / 8.5).
  IF v_is_new THEN
    SELECT * INTO v_source FROM game_point_sources
    WHERE tenant = p_tenant AND action_type = 'weekly_case_participated';

    IF FOUND AND v_source.enabled THEN
      v_points := v_source.points_value;

      -- Emit the audit event (Req. 8.1 / 8.2). Idempotent via the partial
      -- unique index on (tenant, user_id, action_type, source_ref).
      INSERT INTO game_point_events (
        tenant, user_id, action_type, points_awarded, source_ref, occurred_date
      )
      VALUES (
        p_tenant, v_user_id, 'weekly_case_participated', v_points,
        p_case_id::text, v_today
      )
      ON CONFLICT (tenant, user_id, action_type, source_ref)
        WHERE action_type = 'weekly_case_participated'
        DO NOTHING
      RETURNING id INTO v_event_id;

      IF v_event_id IS NOT NULL THEN
        v_event_created := true;

        -- Streak (only if the source counts and is enabled).
        v_counts_streak := COALESCE(v_source.counts_for_streak, false)
                           AND COALESCE(v_source.enabled, false);
        IF v_counts_streak THEN
          SELECT o_current, o_longest INTO v_new_current, v_new_longest
          FROM apply_streak(p_tenant, v_user_id, v_today);
        END IF;

        -- Challenges + badges within the same transaction (Slice 2/3 engines).
        v_completed := evaluate_challenges_for_event(v_event_id);
        PERFORM evaluate_badges_for_event(v_event_id);
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'is_new', v_is_new,
    'points_awarded', CASE WHEN v_event_created THEN v_points ELSE 0 END,
    'completed_challenges', v_completed
  );
END;
$$;

REVOKE ALL ON FUNCTION submit_weekly_case_answer(TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_weekly_case_answer(TEXT, UUID, TEXT) TO authenticated;


-- ── 8. publish_weekly_case_resolution ─────────────────────────
-- Admin publishes the commented resolution of a closed case (closed->resolved).
CREATE OR REPLACE FUNCTION publish_weekly_case_resolution(
  p_tenant             TEXT,
  p_case_id            UUID,
  p_resolution_content TEXT,
  p_visibility         game_resolution_visibility
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case   game_weekly_cases%ROWTYPE;
  v_status game_weekly_case_status;
  v_plain  TEXT;
BEGIN
  -- Admin only (Req. 6.4).
  IF get_current_user_rol() <> 'admin' THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  v_plain := btrim(regexp_replace(COALESCE(p_resolution_content, ''), '<[^>]*>', '', 'g'));
  v_plain := btrim(replace(replace(v_plain, '&nbsp;', ''), E'\u00A0', ''));
  IF v_plain = '' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'EMPTY_RESOLUTION');
  END IF;

  SELECT * INTO v_case FROM game_weekly_cases
  WHERE tenant = p_tenant AND id = p_case_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'CASE_NOT_FOUND');
  END IF;

  -- Derive + lazily persist close so a just-elapsed open case can be resolved.
  v_status := derive_weekly_case_status(v_case.status, v_case.window_start, v_case.window_end);
  IF v_status = 'closed' AND v_case.status = 'open' THEN
    UPDATE game_weekly_cases SET status = 'closed' WHERE id = v_case.id AND status = 'open';
    v_case.status := 'closed';
  END IF;

  -- Resolution only after the window closes (Req. 6.3): reject draft/open.
  IF v_status <> 'closed' AND v_case.status <> 'closed' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'CASE_NOT_CLOSED');
  END IF;

  UPDATE game_weekly_cases
  SET resolution_content    = p_resolution_content,
      resolution_published  = true,
      resolution_visibility = COALESCE(p_visibility, resolution_visibility),
      status                = 'resolved'
  WHERE id = p_case_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION publish_weekly_case_resolution(TEXT, UUID, TEXT, game_resolution_visibility) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION publish_weekly_case_resolution(TEXT, UUID, TEXT, game_resolution_visibility) TO authenticated;
