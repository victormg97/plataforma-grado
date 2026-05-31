-- Migration 065: Add bloqueos_horario to realtime publication
-- ─────────────────────────────────────────────────────────────────────────────
-- The useBloqueos hook subscribes to postgres_changes on bloqueos_horario, but
-- the table was never added to the supabase_realtime publication (unlike
-- horarios/asistencia). As a result, creating/deleting a schedule block did not
-- propagate to open calendars in realtime. This adds the table to the
-- publication and sets REPLICA IDENTITY FULL so change payloads include row data.
-- COMPLETAMENTE IDEMPOTENTE — seguro de correr múltiples veces.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'bloqueos_horario'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bloqueos_horario;
  END IF;
END $$;

ALTER TABLE public.bloqueos_horario REPLICA IDENTITY FULL;
