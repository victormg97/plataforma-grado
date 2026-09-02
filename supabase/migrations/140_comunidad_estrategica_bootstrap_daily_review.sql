-- 140_comunidad_estrategica_bootstrap_daily_review.sql
--
-- Add the daily-question review to the game bootstrap orchestrator so the
-- "Pregunta del Día" tab loads instantly when the player already answered
-- (previously get_daily_review was fetched lazily on tab open, adding a
-- visible delay). Composes the existing get_daily_review sub-RPC — same
-- maintainable pattern as the rest of get_game_bootstrap.

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
  if not public.game_is_accessible(p_tenant) then
    return jsonb_build_object('accessible', false);
  end if;

  select to_jsonb(gs.*) into v_settings
  from public.game_settings gs
  where gs.tenant = p_tenant;

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

  v_ranking := public.get_monthly_ranking(p_tenant, null, 20, 0);
  v_my_position := public.get_my_ranking_position(p_tenant, null);
  v_ranking := coalesce(v_ranking, '{}'::jsonb)
    || jsonb_build_object('my_position', coalesce(v_my_position, jsonb_build_object('has_position', false)));

  return jsonb_build_object(
    'accessible', true,
    'settings', v_settings,
    'profile', public.get_game_profile(p_tenant),
    'daily_question', v_daily,
    'daily_review', public.get_daily_review(p_tenant),
    'quiz_subjects', public.get_quiz_subjects(p_tenant),
    'ranking', v_ranking,
    'challenges', public.get_active_challenges(p_tenant),
    'badges', public.get_user_badges(p_tenant),
    'weekly_case', public.get_current_weekly_case(p_tenant)
  );
end;
$$;

grant execute on function public.get_game_bootstrap(text) to authenticated;
