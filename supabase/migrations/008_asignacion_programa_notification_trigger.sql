-- ============================================================
-- Trigger: create a notification automatically whenever a
-- student is assigned to a programa (INSERT on asignaciones_programa).
--
-- Notifies:
--   1. The alumno  → "Se te asignó el programa de clases: <nombre>"
--   2. The profesor (if different from the assigner) → "El admin asignó..."
--
-- Runs as SECURITY DEFINER so it bypasses RLS and can always
-- insert into notificaciones regardless of who triggered the insert.
-- ============================================================

CREATE OR REPLACE FUNCTION create_notification_on_asignacion_programa()
RETURNS TRIGGER AS $$
DECLARE
  v_programa_nombre  text;
  v_alumno_nombre    text;
  v_asignador_id     uuid;
  v_asignador_rol    text;
BEGIN
  -- Get the program name
  SELECT nombre
    INTO v_programa_nombre
    FROM public.programas_clases
   WHERE id = NEW.programa_id;

  v_programa_nombre := COALESCE(v_programa_nombre, 'programa');

  -- Get the alumno's full name
  SELECT nombre || ' ' || apellido
    INTO v_alumno_nombre
    FROM public.profiles
   WHERE id = NEW.alumno_id;

  v_alumno_nombre := COALESCE(v_alumno_nombre, 'El alumno');

  -- Notify the alumno
  INSERT INTO public.notificaciones
    (destinatario_id, tipo, mensaje, horario_id, alumno_id, leida)
  VALUES
    (NEW.alumno_id, 'programa_asignado', 'Se te asignó el programa de clases: "' || v_programa_nombre || '"', NULL, NULL, false);

  -- If assigned by an admin (profesor_id set and different from created_by of the program),
  -- also notify the assigned professor.
  -- We detect "assigning user is admin" by checking if the row's profesor_id differs from
  -- the session user (auth.uid()), which means an admin set a specific professor.
  IF NEW.profesor_id IS NOT NULL AND NEW.profesor_id <> auth.uid() THEN
    INSERT INTO public.notificaciones
      (destinatario_id, tipo, mensaje, horario_id, alumno_id, leida)
    VALUES
      (NEW.profesor_id, 'programa_asignado',
       'El administrador asignó el programa "' || v_programa_nombre || '" a ' || v_alumno_nombre,
       NULL, NEW.alumno_id, false);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop first so this migration is re-runnable (suppress NOTICE if not exists)
SET client_min_messages TO 'warning';
DROP TRIGGER IF EXISTS asignacion_programa_on_insert ON public.asignaciones_programa;
SET client_min_messages TO 'notice';

CREATE TRIGGER asignacion_programa_on_insert
  AFTER INSERT ON public.asignaciones_programa
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_on_asignacion_programa();
