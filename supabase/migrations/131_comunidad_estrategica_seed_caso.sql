-- Migration 131: Comunidad Estratégica (Slice 4) — Seed / habilitación de puntos
-- ============================================================
-- - Habilita la fuente de puntos weekly_case_participated para el tenant
--   pregunta-estrategica (Slice 1 la dejó enabled=false, points_value=0).
--   El admin también puede ajustar esto desde la pestaña "Puntos" del panel.
-- - Siembra un caso de ejemplo (open, ventana semanal America/Santiago).
-- Datos de ejemplo, idempotentes.
-- ============================================================

-- ── 1. Habilitar puntos por participación en el caso semanal ──
UPDATE game_point_sources
SET enabled = true,
    points_value = 20
WHERE tenant = 'pregunta-estrategica'
  AND action_type = 'weekly_case_participated'
  AND enabled = false
  AND points_value = 0;


-- ── 2. Caso de ejemplo (ventana de la semana en curso, America/Santiago) ──
INSERT INTO game_weekly_cases (
  tenant, title, content, window_start, window_end, status, resolution_visibility
)
SELECT
  'pregunta-estrategica',
  'Caso de ejemplo: Contrato de compraventa',
  '<p>Analice el siguiente supuesto y fundamente su respuesta citando las normas aplicables del Código Civil.</p><p><em>(Este es un caso de ejemplo generado por la migración de siembra del Slice 4.)</em></p>',
  timezone('America/Santiago', date_trunc('week', timezone('America/Santiago', now()))),
  timezone('America/Santiago', date_trunc('week', timezone('America/Santiago', now())) + INTERVAL '1 week'),
  'open',
  'participants_only'
WHERE NOT EXISTS (
  SELECT 1 FROM game_weekly_cases
  WHERE tenant = 'pregunta-estrategica'
    AND title = 'Caso de ejemplo: Contrato de compraventa'
);
