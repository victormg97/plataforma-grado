-- Migration 132: Comunidad Estratégica — Reset de progreso por periodo en desafíos
-- ============================================================
-- Los desafíos weekly/monthly deben contar SOLO los eventos del periodo
-- vigente (semana/mes en America/Santiago). Hasta ahora game_challenge_progress
-- guardaba un único progress_count acumulado entre periodos. Se añade
-- period_start para segmentar el progreso por periodo: cuando llega un evento
-- de un periodo distinto al almacenado, el conteo se reinicia a 0 antes de
-- aplicar el incremento. Los desafíos 'custom' tienen una sola ventana, así
-- que su comportamiento no cambia.
-- ============================================================

-- ── 1. Nueva columna: inicio del periodo al que pertenece el progreso ─────────
ALTER TABLE game_challenge_progress
  ADD COLUMN IF NOT EXISTS period_start TIMESTAMPTZ;


-- ── 2. Reescritura de evaluate_challenges_for_event con reset por periodo ─────
CREATE OR REPLACE FUNCTION evaluate_challenges_for_event(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evt        game_point_events%ROWTYPE;
  v_ch         game_challenges%ROWTYPE;
  v_target     INTEGER;
  v_win_start  TIMESTAMPTZ;
  v_win_end    TIMESTAMPTZ;
  v_prog       game_challenge_progress%ROWTYPE;
  v_new_count  INTEGER;
  v_was_null   BOOLEAN;
  v_same_period BOOLEAN;
  v_base_count INTEGER;
  v_completed  JSONB := '[]'::jsonb;
BEGIN
  SELECT * INTO v_evt FROM game_point_events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN v_completed;
  END IF;

  FOR v_ch IN
    SELECT * FROM game_challenges c
    WHERE c.tenant = v_evt.tenant
      AND c.enabled = true
      AND (c.criteria ->> 'action_type') = v_evt.action_type::text
      AND (
        (c.criteria -> 'category') IS NULL
        OR (c.criteria ->> 'category') = v_evt.category_id::text
      )
  LOOP
    -- Vigency window for this challenge relative to the event instant.
    SELECT o_start, o_end INTO v_win_start, v_win_end
    FROM challenge_period_bounds(v_ch.period_type, v_ch.starts_at, v_ch.ends_at, v_evt.occurred_at);

    -- Event outside the vigency window: skip.
    CONTINUE WHEN v_win_start IS NULL OR v_win_end IS NULL
      OR v_evt.occurred_at < v_win_start OR v_evt.occurred_at >= v_win_end;

    v_target := (v_ch.criteria ->> 'count')::int;

    -- Load existing progress (if any).
    SELECT * INTO v_prog
    FROM game_challenge_progress
    WHERE tenant = v_evt.tenant AND user_id = v_evt.user_id AND challenge_id = v_ch.id;

    -- Dedupe: this event already applied to this challenge.
    IF FOUND AND v_prog.last_event_id IS NOT DISTINCT FROM p_event_id THEN
      CONTINUE;
    END IF;

    -- Does the stored progress belong to the SAME period as this event?
    -- If period_start is NULL (legacy rows) or differs, we start a new period.
    v_same_period := FOUND
      AND v_prog.period_start IS NOT NULL
      AND v_prog.period_start = v_win_start;

    -- Base count to increment from: existing count if same period, else 0.
    v_base_count := CASE WHEN v_same_period THEN COALESCE(v_prog.progress_count, 0) ELSE 0 END;

    -- Already at target within the SAME period: no increment, keep completed_at.
    IF v_same_period AND v_base_count >= v_target THEN
      CONTINUE;
    END IF;

    -- completed_at is per-period: reset it when entering a new period.
    v_was_null := (NOT v_same_period) OR (v_prog.completed_at IS NULL) OR (NOT FOUND);
    v_new_count := LEAST(v_base_count + 1, v_target);

    INSERT INTO game_challenge_progress (
      tenant, user_id, challenge_id, progress_count, completed_at, last_event_id, period_start
    )
    VALUES (
      v_evt.tenant, v_evt.user_id, v_ch.id, v_new_count,
      CASE WHEN v_new_count >= v_target THEN v_evt.occurred_at ELSE NULL END,
      p_event_id, v_win_start
    )
    ON CONFLICT (tenant, user_id, challenge_id) DO UPDATE SET
      progress_count = v_new_count,
      completed_at   = CASE
        -- New period: reset completion, only set if the single event completes it.
        WHEN game_challenge_progress.period_start IS DISTINCT FROM v_win_start THEN
          CASE WHEN v_new_count >= v_target THEN v_evt.occurred_at ELSE NULL END
        -- Same period: keep an existing completion, else set on reaching target.
        WHEN game_challenge_progress.completed_at IS NOT NULL THEN game_challenge_progress.completed_at
        WHEN v_new_count >= v_target THEN v_evt.occurred_at
        ELSE NULL
      END,
      last_event_id  = p_event_id,
      period_start   = v_win_start;

    -- Newly completed by this event (within its period).
    IF v_new_count >= v_target AND v_was_null THEN
      v_completed := v_completed || jsonb_build_object('challenge_id', v_ch.id, 'title', v_ch.title);
    END IF;
  END LOOP;

  RETURN v_completed;
END;
$$;

REVOKE ALL ON FUNCTION evaluate_challenges_for_event(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION evaluate_challenges_for_event(UUID) TO authenticated;


-- ── 3. get_active_challenges: progreso solo del periodo vigente ───────────────
-- Si la fila de progreso pertenece a un periodo anterior (period_start distinto
-- del periodo vigente), se muestra 0 y no completado, reflejando el reinicio.
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
      'target_count', (c.criteria ->> 'count')::int,
      -- Only count progress that belongs to the current period window.
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

REVOKE ALL ON FUNCTION get_active_challenges(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_active_challenges(TEXT) TO authenticated;


-- ── 4. Backfill: marcar el period_start de las filas existentes ───────────────
-- Para no perder el progreso ya acumulado de forma incoherente, asignamos a las
-- filas existentes el inicio del periodo vigente de su desafío (mejor esfuerzo).
UPDATE game_challenge_progress pr
SET period_start = b.o_start
FROM game_challenges c,
     LATERAL challenge_period_bounds(c.period_type, c.starts_at, c.ends_at, now()) b
WHERE pr.challenge_id = c.id
  AND pr.tenant = c.tenant
  AND pr.period_start IS NULL;
