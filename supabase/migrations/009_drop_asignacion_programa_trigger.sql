-- Drop the trigger that created programa_asignado notifications automatically.
-- Notification creation is now handled directly in the API route
-- (app/api/programas/[id]/asignar/route.ts) using the authenticated client,
-- which ensures Supabase Realtime fires the event to the subscriber correctly.
SET client_min_messages TO 'warning';
DROP TRIGGER IF EXISTS asignacion_programa_on_insert ON public.asignaciones_programa;
DROP FUNCTION IF EXISTS create_notification_on_asignacion_programa();
SET client_min_messages TO 'notice';
