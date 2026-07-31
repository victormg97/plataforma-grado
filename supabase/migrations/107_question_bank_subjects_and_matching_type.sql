-- Add 'matching' to the question type enum
ALTER TYPE qb_question_type ADD VALUE IF NOT EXISTS 'matching';

-- Create subjects table (Materia - top level in hierarchy: Materia > Categoría > Tags)
CREATE TABLE IF NOT EXISTS qb_subjects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant      TEXT NOT NULL,
  name        TEXT NOT NULL,
  keywords    TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT qb_subjects_tenant_name_unique UNIQUE (tenant, name)
);

CREATE INDEX idx_qb_subjects_tenant ON qb_subjects (tenant);

CREATE TRIGGER qb_subjects_updated_at
  BEFORE UPDATE ON qb_subjects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE qb_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qb_subjects_admin_all"
  ON qb_subjects FOR ALL
  TO authenticated
  USING (get_current_user_rol() = 'admin')
  WITH CHECK (get_current_user_rol() = 'admin');

-- Add subject_id column to questions
ALTER TABLE qb_questions ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES qb_subjects(id) ON DELETE SET NULL;
CREATE INDEX idx_qb_questions_subject ON qb_questions (subject_id);

-- Updated RPC: all filter params as TEXT for flexibility, added p_subject_id
DROP FUNCTION IF EXISTS get_qb_questions(TEXT, TEXT, UUID, UUID[], qb_question_type, TEXT, qb_status, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION get_qb_questions(
  p_tenant TEXT,
  p_search TEXT DEFAULT NULL,
  p_category_id UUID DEFAULT NULL,
  p_tag_ids UUID[] DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_difficulty TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_subject_id UUID DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offset INTEGER;
  v_total BIGINT;
  v_results JSONB;
BEGIN
  IF get_current_user_rol() != 'admin' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  v_offset := (p_page - 1) * p_page_size;

  SELECT count(*) INTO v_total
  FROM qb_questions q
  WHERE q.tenant = p_tenant
    AND (p_search IS NULL OR q.search_vector @@ plainto_tsquery('spanish', p_search))
    AND (p_category_id IS NULL OR q.category_id = p_category_id)
    AND (p_subject_id IS NULL OR q.subject_id = p_subject_id)
    AND (p_type IS NULL OR q.type = p_type::qb_question_type)
    AND (
      p_difficulty IS NULL
      OR (p_difficulty = 'unrated' AND q.difficulty IS NULL)
      OR (p_difficulty != 'unrated' AND q.difficulty = p_difficulty::qb_difficulty)
    )
    AND (p_status IS NULL OR q.status = p_status::qb_status)
    AND (p_date_from IS NULL OR q.created_at >= p_date_from)
    AND (p_date_to IS NULL OR q.created_at <= p_date_to)
    AND (p_tag_ids IS NULL OR EXISTS (
      SELECT 1 FROM qb_question_tags qt
      WHERE qt.question_id = q.id AND qt.tag_id = ANY(p_tag_ids)
    ));

  SELECT jsonb_agg(row_to_json(sub.*))
  INTO v_results
  FROM (
    SELECT
      q.id,
      q.type,
      q.content,
      q.explanation,
      q.options,
      q.category_id,
      c.name AS category_name,
      q.subject_id,
      s.name AS subject_name,
      q.difficulty,
      q.status,
      q.created_by,
      p.nombre AS created_by_nombre,
      p.apellido AS created_by_apellido,
      q.updated_by,
      q.created_at,
      q.updated_at,
      q.import_batch_id,
      (
        SELECT jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name))
        FROM qb_question_tags qt
        JOIN qb_tags t ON t.id = qt.tag_id
        WHERE qt.question_id = q.id
      ) AS tags
    FROM qb_questions q
    LEFT JOIN qb_categories c ON c.id = q.category_id
    LEFT JOIN qb_subjects s ON s.id = q.subject_id
    LEFT JOIN profiles p ON p.id = q.created_by
    WHERE q.tenant = p_tenant
      AND (p_search IS NULL OR q.search_vector @@ plainto_tsquery('spanish', p_search))
      AND (p_category_id IS NULL OR q.category_id = p_category_id)
      AND (p_subject_id IS NULL OR q.subject_id = p_subject_id)
      AND (p_type IS NULL OR q.type = p_type::qb_question_type)
      AND (
        p_difficulty IS NULL
        OR (p_difficulty = 'unrated' AND q.difficulty IS NULL)
        OR (p_difficulty != 'unrated' AND q.difficulty = p_difficulty::qb_difficulty)
      )
      AND (p_status IS NULL OR q.status = p_status::qb_status)
      AND (p_date_from IS NULL OR q.created_at >= p_date_from)
      AND (p_date_to IS NULL OR q.created_at <= p_date_to)
      AND (p_tag_ids IS NULL OR EXISTS (
        SELECT 1 FROM qb_question_tags qt
        WHERE qt.question_id = q.id AND qt.tag_id = ANY(p_tag_ids)
      ))
    ORDER BY q.created_at DESC
    LIMIT p_page_size
    OFFSET v_offset
  ) sub;

  RETURN jsonb_build_object(
    'data', COALESCE(v_results, '[]'::jsonb),
    'total', v_total,
    'page', p_page,
    'page_size', p_page_size,
    'total_pages', CEIL(v_total::numeric / p_page_size)
  );
END;
$$;
