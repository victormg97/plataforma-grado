-- 137_comunidad_estrategica_game_bootstrap.sql
--
-- Player-side bootstrap orchestrator for Comunidad Estratégica.
--
-- get_game_bootstrap(p_tenant) composes the existing read sub-RPCs into a
-- single jsonb payload so the game (and its main tabs) load in ONE database
-- round-trip instead of ~8 separate calls. This matters on the player side
-- because many users hit it concurrently.
--
-- Design:
--   * NOT a monolithic query: it calls the small, independent sub-RPCs that
--     already exist (get_game_profile, get_quiz_subjects, get_monthly_ranking,
--     get_my_ranking_position, get_active_challenges, get_user_badges,
--     get_current_weekly_case) plus the daily-question assembly. Adding a tab
--     later = add its sub-RPC + one line here.
--   * SECURITY DEFINER + gates on game_is_accessible(p_tenant), mirroring the
--     sub-RPCs. Not accessible => { "accessible": false } (no data leaked).
--   * The daily_question piece mirrors the /api/game/daily-question route:
--     resolve today's question id, strip correctness from options, and report
--     whether the caller already answered today.
--
-- Only composes READ RPCs. Mutations (answers, quiz start/submit, nickname)
-- keep their own routes.

create or replace function public.get_game_bootstrap(p_tenant text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_settings jsonb;
  v_daily jsonb;
  v_question_id uuid;
  v_question record;
  v_already boolean := false;
  v_ranking jsonb;
  v_my_position jsonb;
begin
  -- Access gate (same rule the sub-RPCs enforce).
  if not public.game_is_accessible(p_tenant) then
    return jsonb_build_object('accessible', false);
  end if;

  -- Settings: plain table read (there is no settings RPC). Full row as jsonb.
  select to_jsonb(gs.*) into v_settings
  from public.game_settings gs
  where gs.tenant = p_tenant;

  -- Daily question: resolve today's id, sanitize options, check answered.
  v_question_id := public.select_daily_question(p_tenant);

  if v_question_id is not null then
    select q.id, q.type, q.content, q.options
      into v_question
    from public.qb_questions q
    where q.id = v_question_id;

    if found then
      select exists(
        select 1 from public.game_point_events e
        where e.tenant = p_tenant
          and e.user_id = v_user
          and e.action_type = 'daily_question_answered'
          and e.source_ref = v_question_id::text
      ) into v_already;

      v_daily := jsonb_build_object(
        'question', jsonb_build_object(
          'id', v_question.id,
          'type', v_question.type,
          'content', v_question.content,
          'options', case
            when v_question.type in ('single_choice', 'multiple_choice')
              and jsonb_typeof(v_question.options) = 'array'
              then (
                select coalesce(jsonb_agg(jsonb_build_object('text', coalesce(opt->>'text', ''))), '[]'::jsonb)
                from jsonb_array_elements(v_question.options) opt
              )
            when v_question.type = 'true_false' then '{}'::jsonb
            else v_question.options
          end
        ),
        'already_answered', v_already
      );
    else
      v_daily := jsonb_build_object('question', null, 'already_answered', false);
    end if;
  else
    v_daily := jsonb_build_object('question', null, 'already_answered', false);
  end if;

  -- Ranking (current month, first page) + caller's own position, merged the
  -- same way the /api/game/ranking route does.
  v_ranking := public.get_monthly_ranking(p_tenant, null, 20, 0);
  v_my_position := public.get_my_ranking_position(p_tenant, null);
  v_ranking := coalesce(v_ranking, '{}'::jsonb)
    || jsonb_build_object('my_position', coalesce(v_my_position, jsonb_build_object('has_position', false)));

  return jsonb_build_object(
    'accessible', true,
    'settings', v_settings,
    'profile', public.get_game_profile(p_tenant),
    'daily_question', v_daily,
    'quiz_subjects', public.get_quiz_subjects(p_tenant),
    'ranking', v_ranking,
    'challenges', public.get_active_challenges(p_tenant),
    'badges', public.get_user_badges(p_tenant),
    'weekly_case', public.get_current_weekly_case(p_tenant)
  );
end;
$$;

grant execute on function public.get_game_bootstrap(text) to authenticated;
