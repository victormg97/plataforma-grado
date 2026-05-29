-- Migration 051: Fix get_alumno_ficha RPC + missing tables for new tenants
-- ─────────────────────────────────────────────────────────────────────────────
-- PROBLEMA: La BD de nuevos tenants (ej. pregunta-estrategica) tiene la versión
-- antigua de get_alumno_ficha (2 params, sin notas_alumno ni pruebas).
-- La API llama con 3 params (p_autor_id) → error "function does not exist".
--
-- También pueden faltar las tablas bloqueos_horario y carpetas_recursos.
-- COMPLETAMENTE IDEMPOTENTE.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. get_alumno_ficha — versión completa con notas, pruebas y p_autor_id ───
-- Primero eliminamos el overload viejo de 2 params para evitar ambigüedad
DROP FUNCTION IF EXISTS public.get_alumno_ficha(uuid, integer);

CREATE OR REPLACE FUNCTION public.get_alumno_ficha(
  p_alumno_id uuid,
  p_limit     integer DEFAULT 10,
  p_autor_id  uuid    DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result     json;
  v_autor_id uuid;
BEGIN
  -- Usar el autor_id provisto o caer en auth.uid()
  v_autor_id := COALESCE(p_autor_id, auth.uid());

  SELECT json_build_object(
    'profile', (SELECT row_to_json(p) FROM profiles p WHERE p.id = p_alumno_id),
    'extra',   (SELECT row_to_json(ae) FROM alumnos_extra ae WHERE ae.alumno_id = p_alumno_id),

    'notas_alumno', (
      SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::json)
      FROM (
        SELECT na.id, na.contenido, na.created_at, na.updated_at,
          json_build_object('id', pr.id, 'nombre', pr.nombre, 'apellido', pr.apellido) AS autor
        FROM notas_alumno na
        JOIN profiles pr ON pr.id = na.autor_id
        WHERE na.alumno_id = p_alumno_id AND na.autor_id = v_autor_id
      ) t
    ),

    'horarios', (
      SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.fecha DESC), '[]'::json)
      FROM (
        SELECT h.id, h.titulo, h.fecha, h.hora_inicio, h.hora_fin, h.descripcion,
          h.from_programa,
          (SELECT json_agg(json_build_object('id', a.id, 'estado', a.estado, 'nota_alumno', a.nota_alumno))
           FROM asistencia a WHERE a.horario_id = h.id) AS asistencia
        FROM horarios h
        WHERE h.alumno_id = p_alumno_id AND h.activo = true
        ORDER BY h.fecha DESC
      ) t
    ),

    'pruebas', (
      SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.fecha DESC), '[]'::json)
      FROM (
        SELECT pr.id, pr.nombre, pr.fecha, pr.nota, pr.estado, pr.observaciones,
          pr.clase_id, pr.horario_id
        FROM pruebas pr
        WHERE pr.alumno_id = p_alumno_id
        ORDER BY pr.fecha DESC
      ) t
    ),

    'stats', (
      SELECT json_build_object(
        'total_clases',    count(*),
        'confirmadas',     count(*) FILTER (WHERE sub.estado = 'confirmado'),
        'canceladas',      count(*) FILTER (WHERE sub.estado = 'cancelado'),
        'pendientes',      count(*) FILTER (WHERE sub.estado = 'pendiente'),
        'no_asistio',      count(*) FILTER (WHERE sub.estado = 'no_asistio'),
        'tasa_asistencia', CASE WHEN count(*) > 0
          THEN round(100.0 * count(*) FILTER (WHERE sub.estado = 'confirmado') / count(*), 1)
          ELSE 0 END
      )
      FROM (
        SELECT COALESCE(
          (SELECT a.estado FROM asistencia a WHERE a.horario_id = h.id LIMIT 1),
          'pendiente'
        ) AS estado
        FROM horarios h
        WHERE h.alumno_id = p_alumno_id AND h.activo = true
      ) sub
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_alumno_ficha(uuid, integer, uuid) TO authenticated;

-- ── 2. bloqueos_horario — tabla completa (idempotente) ───────────────────────
CREATE TABLE IF NOT EXISTS public.bloqueos_horario (
  id          uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  profesor_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fecha       date        NOT NULL,
  hora_inicio time        NOT NULL,
  hora_fin    time        NOT NULL,
  motivo      text,
  activo      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bloqueo_horas_validas CHECK (hora_fin > hora_inicio)
);

CREATE INDEX IF NOT EXISTS bloqueos_horario_profesor_id_idx ON public.bloqueos_horario(profesor_id);
CREATE INDEX IF NOT EXISTS bloqueos_horario_fecha_idx       ON public.bloqueos_horario(fecha);

ALTER TABLE public.bloqueos_horario ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bloqueos_horario' AND policyname='bloqueos_select') THEN
    CREATE POLICY "bloqueos_select" ON public.bloqueos_horario FOR SELECT
      USING (profesor_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bloqueos_horario' AND policyname='bloqueos_insert') THEN
    CREATE POLICY "bloqueos_insert" ON public.bloqueos_horario FOR INSERT
      WITH CHECK (profesor_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bloqueos_horario' AND policyname='bloqueos_update') THEN
    CREATE POLICY "bloqueos_update" ON public.bloqueos_horario FOR UPDATE
      USING (profesor_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bloqueos_horario' AND policyname='bloqueos_delete') THEN
    CREATE POLICY "bloqueos_delete" ON public.bloqueos_horario FOR DELETE
      USING (profesor_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_bloqueos_horario_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='bloqueos_horario_updated_at') THEN
    CREATE TRIGGER bloqueos_horario_updated_at
      BEFORE UPDATE ON public.bloqueos_horario
      FOR EACH ROW EXECUTE FUNCTION public.set_bloqueos_horario_updated_at();
  END IF;
END $$;

-- ── 3. carpetas_recursos — tabla completa (idempotente) ──────────────────────
CREATE TABLE IF NOT EXISTS public.carpetas_recursos (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text        NOT NULL,
  parent_id  uuid        REFERENCES public.carpetas_recursos(id) ON DELETE CASCADE,
  creada_por uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS carpetas_recursos_parent_id_idx  ON public.carpetas_recursos(parent_id);
CREATE INDEX IF NOT EXISTS carpetas_recursos_creada_por_idx ON public.carpetas_recursos(creada_por);

ALTER TABLE public.carpetas_recursos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='carpetas_recursos' AND policyname='carpetas_admin_all') THEN
    CREATE POLICY "carpetas_admin_all" ON public.carpetas_recursos FOR ALL TO authenticated
      USING ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'admin')
      WITH CHECK ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'admin');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='carpetas_recursos' AND policyname='carpetas_profesor_select') THEN
    CREATE POLICY "carpetas_profesor_select" ON public.carpetas_recursos FOR SELECT TO authenticated
      USING ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'profesor' AND creada_por = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='carpetas_recursos' AND policyname='carpetas_profesor_insert') THEN
    CREATE POLICY "carpetas_profesor_insert" ON public.carpetas_recursos FOR INSERT TO authenticated
      WITH CHECK ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'profesor' AND creada_por = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='carpetas_recursos' AND policyname='carpetas_profesor_update') THEN
    CREATE POLICY "carpetas_profesor_update" ON public.carpetas_recursos FOR UPDATE TO authenticated
      USING ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'profesor' AND creada_por = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='carpetas_recursos' AND policyname='carpetas_profesor_delete') THEN
    CREATE POLICY "carpetas_profesor_delete" ON public.carpetas_recursos FOR DELETE TO authenticated
      USING ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'profesor' AND creada_por = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='carpetas_recursos' AND policyname='carpetas_alumno_select') THEN
    CREATE POLICY "carpetas_alumno_select" ON public.carpetas_recursos FOR SELECT TO authenticated
      USING (
        (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'alumno'
        AND EXISTS (
          SELECT 1 FROM public.recursos_compartidos rc
          WHERE rc.carpeta_id = carpetas_recursos.id
            AND (
              EXISTS (SELECT 1 FROM public.recursos_acceso ra WHERE ra.recurso_id = rc.id AND ra.alumno_id = auth.uid())
              OR (rc.para_todos = true AND (SELECT rol FROM public.profiles WHERE id = rc.subido_por) = 'admin')
              OR (rc.para_todos = true AND EXISTS (
                SELECT 1 FROM public.alumnos_extra ae WHERE ae.alumno_id = auth.uid() AND ae.profesor_id = rc.subido_por
              ))
            )
        )
      );
  END IF;
END $$;

-- Trigger updated_at para carpetas
CREATE OR REPLACE FUNCTION public.carpetas_recursos_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='carpetas_recursos_updated_at') THEN
    CREATE TRIGGER carpetas_recursos_updated_at
      BEFORE UPDATE ON public.carpetas_recursos
      FOR EACH ROW EXECUTE FUNCTION public.carpetas_recursos_set_updated_at();
  END IF;
END $$;

-- carpeta_id en recursos_compartidos
ALTER TABLE public.recursos_compartidos
  ADD COLUMN IF NOT EXISTS carpeta_id uuid REFERENCES public.carpetas_recursos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS recursos_compartidos_carpeta_id_idx ON public.recursos_compartidos(carpeta_id);
