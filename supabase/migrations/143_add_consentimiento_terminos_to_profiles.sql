-- ── 143: Evidencia de consentimiento (Ley 21.719) ──────────────────────────
-- La Ley 21.719 exige que el consentimiento sea demostrable: hay que poder
-- acreditar CUÁNDO y QUÉ versión de los documentos legales aceptó el titular.
-- Hasta ahora el checkbox "acepto los Términos" se validaba en el formulario
-- pero no dejaba rastro en la base de datos. Estas columnas guardan esa
-- evidencia en el perfil del usuario.
--
-- - terminos_aceptados_at: timestamp del acto de aceptación (NULL = sin registro).
-- - terminos_version: versión de los Términos y Condiciones aceptada.
-- - privacidad_version: versión de la Política de Privacidad vigente al aceptar.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terminos_aceptados_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS terminos_version text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS privacidad_version text DEFAULT NULL;

COMMENT ON COLUMN public.profiles.terminos_aceptados_at IS 'Fecha/hora en que el titular aceptó los Términos y la Política (evidencia de consentimiento, Ley 21.719). NULL = sin registro.';
COMMENT ON COLUMN public.profiles.terminos_version IS 'Versión de los Términos y Condiciones aceptada por el titular.';
COMMENT ON COLUMN public.profiles.privacidad_version IS 'Versión de la Política de Privacidad vigente al momento de aceptar.';
