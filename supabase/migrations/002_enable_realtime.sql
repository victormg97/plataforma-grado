-- 002_enable_realtime.sql
-- Enables Supabase Realtime for the tables used in live subscriptions.
--
-- Without this migration:
--   • The postgres_changes subscriptions in useHorarios, useAsistencia, and
--     useRealtimeNotifications silently receive no events.
--   • Professors see their own calendar only after navigating away and back.
--   • Students don't see newly-assigned classes without a manual page refresh.
--
-- Apply via Supabase CLI:   supabase db push
-- Or paste directly in the Supabase SQL editor.

-- 1. Add tables to the Supabase Realtime publication
--    (idempotent: safe to run multiple times)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'horarios'
  ) then
    alter publication supabase_realtime add table public.horarios;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'asistencia'
  ) then
    alter publication supabase_realtime add table public.asistencia;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notificaciones'
  ) then
    alter publication supabase_realtime add table public.notificaciones;
  end if;
end $$;

-- 2. Set REPLICA IDENTITY FULL on subscribed tables.
--    Required so Realtime can evaluate column-level filters
--    (e.g. alumno_id=eq.<uuid>) on UPDATE and DELETE events and so the
--    full row payload is available in the realtime callback.
alter table public.horarios     replica identity full;
alter table public.asistencia   replica identity full;
alter table public.notificaciones replica identity full;
