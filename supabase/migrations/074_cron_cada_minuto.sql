-- ── 074: Cambiar el cron de auto-cancelación a cada minuto ────────────────────
-- El cron anterior corría cada 15 minutos, lo que dejaba clases pendientes
-- sin cancelar hasta ~15 min después de que vencía el plazo.
-- ──────────────────────────────────────────────────────────────────────────────

-- Reemplazar el job existente con schedule de cada minuto
SELECT cron.unschedule('autocancelar-clases-pendientes');

SELECT cron.schedule(
  'autocancelar-clases-pendientes',
  '* * * * *',   -- cada minuto
  'SELECT public.autocancelar_clases_pendientes()'
);
