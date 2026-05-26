-- ============================================================
-- Pregunta Estratégica — Datos iniciales
-- ============================================================
-- Este seed crea la estructura mínima para el tenant.
-- El usuario admin ya fue creado previamente.
--
-- Credenciales:
-- | Rol   | Email                          | Password     |
-- |-------|--------------------------------|--------------|
-- | Admin | admin@preguntaestrategica.cl   | Admin.2026!  |
-- ============================================================

-- Verificar que el admin existe y actualizar su perfil
UPDATE public.profiles
SET rol = 'admin', nombre = 'Estefanía', apellido = 'Montalbán Pino'
WHERE email = 'admin@preguntaestrategica.cl';

-- ============================================================
-- NOTA: Este tenant empieza vacío (sin profesores ni alumnos).
-- Las propietarias agregarán profesores y alumnos desde el
-- panel de administración de la app.
-- ============================================================
