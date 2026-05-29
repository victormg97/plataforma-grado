-- Tabla para bloqueos de horario de profesores
CREATE TABLE public.bloqueos_horario (
  id            uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  profesor_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fecha         date NOT NULL,
  hora_inicio   time NOT NULL,
  hora_fin      time NOT NULL,
  motivo        text,
  activo        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bloqueo_horas_validas CHECK (hora_fin > hora_inicio)
);

-- Índices
CREATE INDEX bloqueos_horario_profesor_id_idx ON public.bloqueos_horario(profesor_id);
CREATE INDEX bloqueos_horario_fecha_idx ON public.bloqueos_horario(fecha);

-- RLS
ALTER TABLE public.bloqueos_horario ENABLE ROW LEVEL SECURITY;

-- Profesores pueden ver sus propios bloqueos; admins ven todos
CREATE POLICY "bloqueos_select" ON public.bloqueos_horario
  FOR SELECT USING (
    profesor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND rol = 'admin'
    )
  );

-- Solo el propio profesor o un admin puede insertar
CREATE POLICY "bloqueos_insert" ON public.bloqueos_horario
  FOR INSERT WITH CHECK (
    profesor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND rol = 'admin'
    )
  );

-- Solo el propio profesor o un admin puede actualizar
CREATE POLICY "bloqueos_update" ON public.bloqueos_horario
  FOR UPDATE USING (
    profesor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND rol = 'admin'
    )
  );

-- Solo el propio profesor o un admin puede eliminar
CREATE POLICY "bloqueos_delete" ON public.bloqueos_horario
  FOR DELETE USING (
    profesor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND rol = 'admin'
    )
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.set_bloqueos_horario_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER bloqueos_horario_updated_at
  BEFORE UPDATE ON public.bloqueos_horario
  FOR EACH ROW EXECUTE FUNCTION public.set_bloqueos_horario_updated_at();
