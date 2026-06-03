-- ── Habilitar pg_cron ──────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Permitir que el cron acceda al schema public
GRANT USAGE ON SCHEMA public TO postgres;

-- ── Función: auto-cancelar asistencias pendientes cuyo plazo venció ───────────
--
-- Lógica:
--   Para cada asistencia con estado 'pendiente', buscamos el horario asociado.
--   Obtenemos el cancellation_deadline_hours del profesor de ese horario.
--   Si now() >= (hora_inicio_clase - deadline_hours), la asistencia pasa a 'cancelado'.
--   Si deadline_hours = 0, se cancela solo cuando la clase ya haya terminado.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.autocancelar_clases_pendientes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  class_start TIMESTAMPTZ;
  deadline_ts TIMESTAMPTZ;
BEGIN
  -- Iterar sobre todas las asistencias pendientes que aún no han pasado
  FOR r IN
    SELECT
      a.id            AS asistencia_id,
      h.fecha,
      h.hora_inicio,
      h.hora_fin,
      COALESCE(p.cancellation_deadline_hours, 0) AS deadline_hours
    FROM public.asistencia a
    JOIN public.horarios h ON h.id = a.horario_id
    JOIN public.profiles p ON p.id = h.profesor_id
    WHERE a.estado = 'pendiente'
      AND h.activo = TRUE
  LOOP
    -- Construir timestamp de inicio de clase en timezone UTC
    class_start := (r.fecha::text || 'T' || r.hora_inicio::text)::TIMESTAMPTZ;

    IF r.deadline_hours = 0 THEN
      -- Sin plazo: cancelar solo cuando la clase ya terminó
      deadline_ts := (r.fecha::text || 'T' || r.hora_fin::text)::TIMESTAMPTZ;
    ELSE
      -- Con plazo: cancelar cuando now() >= inicio_clase - deadline_hours
      deadline_ts := class_start - (r.deadline_hours * INTERVAL '1 hour');
    END IF;

    -- Si el plazo de confirmación venció, cancelar
    IF NOW() >= deadline_ts THEN
      UPDATE public.asistencia
      SET estado = 'cancelado',
          updated_at = NOW()
      WHERE id = r.asistencia_id;
    END IF;
  END LOOP;
END;
$$;

-- ── Programar el cron: ejecutar cada 15 minutos ────────────────────────────────
-- Primero eliminar si ya existía (idempotente)
SELECT cron.unschedule('autocancelar-clases-pendientes')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'autocancelar-clases-pendientes'
  );

SELECT cron.schedule(
  'autocancelar-clases-pendientes',    -- nombre del job
  '*/15 * * * *',                      -- cada 15 minutos
  'SELECT public.autocancelar_clases_pendientes()'
);

-- ── Comentario explicativo ────────────────────────────────────────────────────
COMMENT ON FUNCTION public.autocancelar_clases_pendientes() IS
  'Cron job: cancela automáticamente las asistencias en estado pendiente cuyo plazo '
  'de confirmación (cancellation_deadline_hours del profesor) ha vencido. '
  'Si deadline = 0, cancela al finalizar la clase. Se ejecuta cada 15 minutos.';
