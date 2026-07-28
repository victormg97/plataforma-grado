-- ============================================================
-- Migration 103: Add configurable welcome message to referral_settings
-- Shown to users (alumno/lector) on their referral page.
-- ============================================================

ALTER TABLE referral_settings
  ADD COLUMN IF NOT EXISTS user_welcome_message TEXT NOT NULL DEFAULT '';

-- Seed for Pregunta Estratégica
UPDATE referral_settings
SET user_welcome_message = '¡Comparte tu Código Estratégico con quien quiera preparar su examen de grado! Cuando alguien se registre con tu código, ambos recibirán beneficios exclusivos. Mientras más personas invites, más recompensas acumulas.'
WHERE tenant = 'pregunta-estrategica';
