-- ── 089: Update get_notas_clase to include apellido_materno ──────────────────
-- The note card needs the full name (including apellido_materno) for display.
-- ─────────────────────────────────────────────────────────────────────────────

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
        'apellido_materno', p.apellido_materno,
        'rol', p.rol,
        'avatar_url', p.avatar_url
      )
    ) ORDER BY n.created_at DESC
  ), '[]'::json)
  FROM public.notas_clase n
  JOIN public.profiles p ON p.id = n.autor_id
  WHERE n.horario_id = p_horario_id;
$$;
