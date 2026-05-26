-- Table: notas_clase
CREATE TABLE public.notas_clase (
  id          uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  horario_id  uuid REFERENCES public.horarios(id) ON DELETE CASCADE NOT NULL,
  autor_id    uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  contenido   text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_notas_clase_horario ON public.notas_clase(horario_id);
CREATE INDEX idx_notas_clase_autor ON public.notas_clase(autor_id);

-- Auto-update updated_at
CREATE TRIGGER notas_clase_updated_at 
  BEFORE UPDATE ON public.notas_clase
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable RLS
ALTER TABLE public.notas_clase ENABLE ROW LEVEL SECURITY;

-- RLS: Student reads notes for their own classes
CREATE POLICY "Alumno ve notas de sus clases" ON public.notas_clase
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.horarios h 
      WHERE h.id = notas_clase.horario_id 
      AND h.alumno_id = auth.uid()
    )
  );

-- RLS: Professor reads notes for classes they teach
CREATE POLICY "Profesor ve notas de sus clases" ON public.notas_clase
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.horarios h 
      WHERE h.id = notas_clase.horario_id 
      AND h.profesor_id = auth.uid()
    )
  );

-- RLS: User creates notes only for their own classes
CREATE POLICY "Usuario crea notas en sus clases" ON public.notas_clase
  FOR INSERT WITH CHECK (
    autor_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.horarios h 
      WHERE h.id = notas_clase.horario_id 
      AND (h.alumno_id = auth.uid() OR h.profesor_id = auth.uid())
    )
  );

-- RLS: User updates only their own notes
CREATE POLICY "Usuario edita sus propias notas" ON public.notas_clase
  FOR UPDATE USING (autor_id = auth.uid());

-- RLS: User deletes only their own notes
CREATE POLICY "Usuario elimina sus propias notas" ON public.notas_clase
  FOR DELETE USING (autor_id = auth.uid());

-- RLS: Admin full access
CREATE POLICY "Admin gestiona todas las notas" ON public.notas_clase
  FOR ALL USING (get_user_rol() = 'admin');

-- RPC: Get notes for a class with author info
CREATE OR REPLACE FUNCTION get_notas_clase(p_horario_id uuid)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT coalesce(json_agg(
    json_build_object(
      'id', n.id,
      'horario_id', n.horario_id,
      'autor_id', n.autor_id,
      'contenido', n.contenido,
      'created_at', n.created_at,
      'updated_at', n.updated_at,
      'autor', json_build_object(
        'id', p.id,
        'nombre', p.nombre,
        'apellido', p.apellido,
        'rol', p.rol,
        'avatar_url', p.avatar_url
      )
    ) ORDER BY n.created_at DESC
  ), '[]'::json)
  FROM public.notas_clase n
  JOIN public.profiles p ON p.id = n.autor_id
  WHERE n.horario_id = p_horario_id;
$$;

-- Server time function
CREATE OR REPLACE FUNCTION get_server_time()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT now();
$$;
