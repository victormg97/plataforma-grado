-- ============================================================
-- CTA Graduados — Datos de prueba
-- ============================================================
-- INSTRUCCIONES:
-- 1. Primero ejecutar 001_initial_schema.sql en Supabase SQL Editor
-- 2. Luego crear los usuarios de prueba en Supabase Dashboard:
--    Authentication > Users > Add User (Email + Password)
--    Crear estos 5 usuarios con las contraseñas indicadas.
-- 3. Después copiar los UUIDs generados por Supabase Auth
--    y reemplazar los placeholders en este archivo.
-- 4. Ejecutar este archivo en el SQL Editor.
--
-- Usuarios de prueba (crear en Auth > Users):
--
-- | Email                         | Password       | Rol      |
-- |-------------------------------|----------------|----------|
-- | admin@cta-grados.cl           | Admin.2026!    | admin    |
-- | carlos.toro@cta-grados.cl     | Profesor.2026! | profesor |
-- | maria.lagos@cta-grados.cl     | Profesor.2026! | profesor |
-- | juan.perez@cta-grados.cl      | Alumno.2026!   | alumno   |
-- | camila.reyes@cta-grados.cl    | Alumno.2026!   | alumno   |
--
-- Al crear cada usuario en el Dashboard, en "User Metadata" agregar:
--   { "nombre": "...", "apellido": "...", "rol": "..." }
-- Esto hará que el trigger handle_new_user() cree el profile automáticamente.
-- ============================================================

-- ALTERNATIVA RÁPIDA: Si prefieres no usar el Dashboard, puedes crear
-- los usuarios directamente con SQL (requiere acceso a auth.users).
-- Descomenta las siguientes líneas y ejecuta:

-- Desactivar trigger temporalmente para insertar perfiles manualmente
-- (útil si los UUIDs de auth.users ya existen)

-- ============================================================
-- PASO 1: Crear usuarios en auth.users
-- (Esto simula lo que hace Supabase Auth signup)
-- ============================================================

-- Genera UUIDs fijos para que los FKs funcionen
DO $$
DECLARE
  v_admin_id     uuid := '583f9f17-0006-4bef-a1d4-918cf5a3e16f';
  v_profesor1_id uuid := '72520064-6a00-4a87-9d40-e4bda957e0fb';
  v_profesor2_id uuid := 'b541b2de-5bff-4c75-8660-71dc2a9157f3';
  v_alumno1_id   uuid := '0dd79cdd-c5d0-4029-9fd3-04fa2b59e171';
  v_alumno2_id   uuid := 'ed294a78-663b-4d81-8316-eb8931a413ac';
BEGIN

-- Insertar en auth.users (password hash para "Test.2026!")
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  aud, role
) VALUES
(
  v_admin_id, '00000000-0000-0000-0000-000000000000',
  'admin@cta-grados.cl',
  crypt('Admin.2026!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"nombre":"Carlos","apellido":"Toro Araya","rol":"admin"}'::jsonb,
  'authenticated', 'authenticated'
),
(
  v_profesor1_id, '00000000-0000-0000-0000-000000000000',
  'carlos.toro@cta-grados.cl',
  crypt('Profesor.2026!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"nombre":"Carlos","apellido":"Toro","rol":"profesor"}'::jsonb,
  'authenticated', 'authenticated'
),
(
  v_profesor2_id, '00000000-0000-0000-0000-000000000000',
  'maria.lagos@cta-grados.cl',
  crypt('Profesor.2026!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"nombre":"María","apellido":"Lagos","rol":"profesor"}'::jsonb,
  'authenticated', 'authenticated'
),
(
  v_alumno1_id, '00000000-0000-0000-0000-000000000000',
  'juan.perez@cta-grados.cl',
  crypt('Alumno.2026!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"nombre":"Juan","apellido":"Pérez","rol":"alumno"}'::jsonb,
  'authenticated', 'authenticated'
),
(
  v_alumno2_id, '00000000-0000-0000-0000-000000000000',
  'camila.reyes@cta-grados.cl',
  crypt('Alumno.2026!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"nombre":"Camila","apellido":"Reyes","rol":"alumno"}'::jsonb,
  'authenticated', 'authenticated'
)
ON CONFLICT (id) DO NOTHING;

-- Crear identidades (requerido por Supabase Auth para login con email)
INSERT INTO auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) VALUES
(v_admin_id, v_admin_id, 'admin@cta-grados.cl',
 jsonb_build_object('sub', v_admin_id, 'email', 'admin@cta-grados.cl'),
 'email', now(), now(), now()),
(v_profesor1_id, v_profesor1_id, 'carlos.toro@cta-grados.cl',
 jsonb_build_object('sub', v_profesor1_id, 'email', 'carlos.toro@cta-grados.cl'),
 'email', now(), now(), now()),
(v_profesor2_id, v_profesor2_id, 'maria.lagos@cta-grados.cl',
 jsonb_build_object('sub', v_profesor2_id, 'email', 'maria.lagos@cta-grados.cl'),
 'email', now(), now(), now()),
(v_alumno1_id, v_alumno1_id, 'juan.perez@cta-grados.cl',
 jsonb_build_object('sub', v_alumno1_id, 'email', 'juan.perez@cta-grados.cl'),
 'email', now(), now(), now()),
(v_alumno2_id, v_alumno2_id, 'camila.reyes@cta-grados.cl',
 jsonb_build_object('sub', v_alumno2_id, 'email', 'camila.reyes@cta-grados.cl'),
 'email', now(), now(), now())
ON CONFLICT DO NOTHING;

-- ============================================================
-- PASO 2: El trigger handle_new_user() ya creó los profiles.
-- Pero si ejecutas esto después de que ya existen, actualizamos:
-- ============================================================

UPDATE public.profiles SET rol = 'admin',    nombre = 'Carlos', apellido = 'Toro Araya' WHERE id = v_admin_id;
UPDATE public.profiles SET rol = 'profesor', nombre = 'Carlos', apellido = 'Toro'       WHERE id = v_profesor1_id;
UPDATE public.profiles SET rol = 'profesor', nombre = 'María',  apellido = 'Lagos'      WHERE id = v_profesor2_id;
UPDATE public.profiles SET rol = 'alumno',   nombre = 'Juan',   apellido = 'Pérez'      WHERE id = v_alumno1_id;
UPDATE public.profiles SET rol = 'alumno',   nombre = 'Camila', apellido = 'Reyes'      WHERE id = v_alumno2_id;

-- ============================================================
-- PASO 3: Datos de fichas de alumnos
-- ============================================================

INSERT INTO public.alumnos_extra (alumno_id, profesor_id, universidad, año_ingreso, notas, paso_prueba)
VALUES
  (v_alumno1_id, v_profesor1_id, 'Universidad de Chile',    '2020', 'Buen progreso en Derecho Civil. Necesita reforzar Penal.', false),
  (v_alumno2_id, v_profesor1_id, 'Pontificia UC',           '2019', 'Excelente rendimiento. Candidata a rendir pronto.', false)
ON CONFLICT (alumno_id) DO UPDATE SET
  profesor_id = EXCLUDED.profesor_id,
  universidad = EXCLUDED.universidad,
  año_ingreso = EXCLUDED.año_ingreso,
  notas       = EXCLUDED.notas;

-- ============================================================
-- PASO 4: Horarios de clases (próximas 2 semanas)
-- ============================================================

INSERT INTO public.horarios (id, profesor_id, alumno_id, titulo, descripcion, fecha, hora_inicio, hora_fin)
VALUES
  -- Clases de Juan con Carlos Toro
  (uuid_generate_v4(), v_profesor1_id, v_alumno1_id,
   'Derecho Civil - Contratos',
   'Revisión de contratos consensuales y reales. Preparar arts. 1437-1469 CC.',
   CURRENT_DATE + INTERVAL '1 day', '19:00', '20:30'),

  (uuid_generate_v4(), v_profesor1_id, v_alumno1_id,
   'Derecho Penal - Parte General',
   'Teoría del delito: tipicidad y antijuridicidad.',
   CURRENT_DATE + INTERVAL '3 days', '17:00', '18:30'),

  (uuid_generate_v4(), v_profesor1_id, v_alumno1_id,
   'Derecho Procesal',
   'Procedimiento ordinario civil. Preparar etapas del juicio.',
   CURRENT_DATE + INTERVAL '7 days', '19:00', '20:30'),

  (uuid_generate_v4(), v_profesor1_id, v_alumno1_id,
   'Derecho Constitucional',
   'Derechos fundamentales y recurso de protección.',
   CURRENT_DATE + INTERVAL '10 days', '18:00', '19:30'),

  -- Clases de Camila con Carlos Toro
  (uuid_generate_v4(), v_profesor1_id, v_alumno2_id,
   'Derecho Civil - Obligaciones',
   'Efectos de las obligaciones y remedios contractuales.',
   CURRENT_DATE + INTERVAL '2 days', '10:00', '11:30'),

  (uuid_generate_v4(), v_profesor1_id, v_alumno2_id,
   'Derecho Comercial',
   'Sociedades: tipos, constitución y responsabilidad.',
   CURRENT_DATE + INTERVAL '5 days', '10:00', '11:30'),

  (uuid_generate_v4(), v_profesor1_id, v_alumno2_id,
   'Derecho Laboral',
   'Contrato individual de trabajo y terminación.',
   CURRENT_DATE + INTERVAL '8 days', '11:00', '12:30'),

  -- Clase pasada (para historial)
  (uuid_generate_v4(), v_profesor1_id, v_alumno1_id,
   'Derecho Civil - Bienes',
   'Clasificación de bienes y dominio.',
   CURRENT_DATE - INTERVAL '3 days', '19:00', '20:30'),

  (uuid_generate_v4(), v_profesor1_id, v_alumno2_id,
   'Derecho Civil - Personas',
   'Atributos de la personalidad.',
   CURRENT_DATE - INTERVAL '5 days', '10:00', '11:30');

-- ============================================================
-- PASO 5: Registros de asistencia
-- ============================================================

-- Crear asistencia pendiente para todas las clases futuras
INSERT INTO public.asistencia (horario_id, alumno_id, estado)
SELECT h.id, h.alumno_id, 'pendiente'
FROM public.horarios h
WHERE h.fecha > CURRENT_DATE
  AND h.activo = true
ON CONFLICT (horario_id, alumno_id) DO NOTHING;

-- Las clases pasadas: marcar como confirmadas
INSERT INTO public.asistencia (horario_id, alumno_id, estado)
SELECT h.id, h.alumno_id, 'confirmado'
FROM public.horarios h
WHERE h.fecha <= CURRENT_DATE
  AND h.activo = true
ON CONFLICT (horario_id, alumno_id) DO NOTHING;

-- ============================================================
-- PASO 6: Habilitar Realtime
-- (Ya manejado por migración 002_enable_realtime.sql)
-- ============================================================

END $$;

-- ============================================================
-- RESUMEN DE CREDENCIALES DE PRUEBA
-- ============================================================
-- | Rol      | Email                      | Password        |
-- |----------|----------------------------|-----------------|
-- | Admin    | admin@cta-grados.cl        | Admin.2026!     |
-- | Profesor | carlos.toro@cta-grados.cl  | Profesor.2026!  |
-- | Profesor | maria.lagos@cta-grados.cl  | Profesor.2026!  |
-- | Alumno   | juan.perez@cta-grados.cl   | Alumno.2026!    |
-- | Alumno   | camila.reyes@cta-grados.cl | Alumno.2026!    |
-- ============================================================
