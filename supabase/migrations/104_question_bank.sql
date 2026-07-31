-- ============================================================
-- Migration 104: Banco de Preguntas (Question Bank)
-- ============================================================
-- Creates:
--   1. question_bank_settings   — per-tenant feature flag
--   2. qb_categories            — question categories (per tenant)
--   3. qb_tags                  — reusable tags (per tenant)
--   4. qb_questions             — main questions table with full-text search
--   5. qb_question_tags         — M:N junction table
--   6. qb_import_batches        — bulk import tracking
-- ============================================================

-- ── 1. question_bank_settings ─────────────────────────────────

CREATE TABLE IF NOT EXISTS question_bank_settings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant            TEXT NOT NULL UNIQUE,
  question_bank_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed: enable for "pregunta-estrategica" tenant
INSERT INTO question_bank_settings (tenant, question_bank_enabled)
VALUES ('pregunta-estrategica', true)
ON CONFLICT (tenant) DO NOTHING;

CREATE TRIGGER question_bank_settings_updated_at
  BEFORE UPDATE ON question_bank_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE question_bank_settings ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read settings (needed for sidebar visibility check)
CREATE POLICY "qb_settings_select_authenticated"
  ON question_bank_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert/update (managed via admin API routes)


-- ── 2. qb_categories ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS qb_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant      TEXT NOT NULL,
  name        TEXT NOT NULL,
  -- Keywords for auto-suggestion engine (array of terms)
  keywords    TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT qb_categories_tenant_name_unique UNIQUE (tenant, name)
);

CREATE INDEX idx_qb_categories_tenant ON qb_categories (tenant);

CREATE TRIGGER qb_categories_updated_at
  BEFORE UPDATE ON qb_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE qb_categories ENABLE ROW LEVEL SECURITY;

-- Admin-only CRUD
CREATE POLICY "qb_categories_admin_all"
  ON qb_categories FOR ALL
  TO authenticated
  USING (get_current_user_rol() = 'admin')
  WITH CHECK (get_current_user_rol() = 'admin');


-- ── 3. qb_tags ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS qb_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant      TEXT NOT NULL,
  name        TEXT NOT NULL,
  -- Keywords for auto-suggestion engine
  keywords    TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT qb_tags_tenant_name_unique UNIQUE (tenant, name)
);

CREATE INDEX idx_qb_tags_tenant ON qb_tags (tenant);

CREATE TRIGGER qb_tags_updated_at
  BEFORE UPDATE ON qb_tags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE qb_tags ENABLE ROW LEVEL SECURITY;

-- Admin-only CRUD
CREATE POLICY "qb_tags_admin_all"
  ON qb_tags FOR ALL
  TO authenticated
  USING (get_current_user_rol() = 'admin')
  WITH CHECK (get_current_user_rol() = 'admin');


-- ── 4. qb_questions ───────────────────────────────────────────

-- Type enum for question types
CREATE TYPE qb_question_type AS ENUM (
  'single_choice',
  'multiple_choice',
  'true_false',
  'open_ended',
  'fill_blank'
);

-- Difficulty enum
CREATE TYPE qb_difficulty AS ENUM ('easy', 'medium', 'hard');

-- Status enum
CREATE TYPE qb_status AS ENUM ('draft', 'active');

CREATE TABLE IF NOT EXISTS qb_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant          TEXT NOT NULL,
  type            qb_question_type NOT NULL,
  -- Rich text HTML content of the question
  content         TEXT NOT NULL,
  -- Flexible JSONB for answer options (structure varies by type)
  -- single_choice: [{text: string, is_correct: boolean}]
  -- multiple_choice: [{text: string, is_correct: boolean}]
  -- true_false: {correct_answer: boolean}
  -- open_ended: {model_answer?: string}
  -- fill_blank: {blanks: [{position: number, accepted_answers: string[]}]}
  options         JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Optional explanation (rich text HTML)
  explanation     TEXT,
  category_id     UUID REFERENCES qb_categories(id) ON DELETE SET NULL,
  difficulty      qb_difficulty NOT NULL DEFAULT 'medium',
  status          qb_status NOT NULL DEFAULT 'draft',
  -- Import batch reference (NULL if created manually)
  import_batch_id UUID,
  -- Audit fields
  created_by      UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Full-text search vector (auto-generated)
  search_vector   TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('spanish', coalesce(content, ''))
  ) STORED
);

CREATE INDEX idx_qb_questions_tenant ON qb_questions (tenant);
CREATE INDEX idx_qb_questions_category ON qb_questions (category_id);
CREATE INDEX idx_qb_questions_type ON qb_questions (tenant, type);
CREATE INDEX idx_qb_questions_difficulty ON qb_questions (tenant, difficulty);
CREATE INDEX idx_qb_questions_status ON qb_questions (tenant, status);
CREATE INDEX idx_qb_questions_created_at ON qb_questions (tenant, created_at DESC);
CREATE INDEX idx_qb_questions_search ON qb_questions USING GIN (search_vector);
CREATE INDEX idx_qb_questions_import_batch ON qb_questions (import_batch_id) WHERE import_batch_id IS NOT NULL;

CREATE TRIGGER qb_questions_updated_at
  BEFORE UPDATE ON qb_questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE qb_questions ENABLE ROW LEVEL SECURITY;

-- Admin-only CRUD
CREATE POLICY "qb_questions_admin_all"
  ON qb_questions FOR ALL
  TO authenticated
  USING (get_current_user_rol() = 'admin')
  WITH CHECK (get_current_user_rol() = 'admin');


-- ── 5. qb_question_tags (M:N junction) ───────────────────────

CREATE TABLE IF NOT EXISTS qb_question_tags (
  question_id UUID NOT NULL REFERENCES qb_questions(id) ON DELETE CASCADE,
  tag_id      UUID NOT NULL REFERENCES qb_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, tag_id)
);

CREATE INDEX idx_qb_question_tags_tag ON qb_question_tags (tag_id);

ALTER TABLE qb_question_tags ENABLE ROW LEVEL SECURITY;

-- Admin-only CRUD
CREATE POLICY "qb_question_tags_admin_all"
  ON qb_question_tags FOR ALL
  TO authenticated
  USING (get_current_user_rol() = 'admin')
  WITH CHECK (get_current_user_rol() = 'admin');


-- ── 6. qb_import_batches ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS qb_import_batches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant        TEXT NOT NULL,
  imported_by   UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  file_name     TEXT NOT NULL,
  total_rows    INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  error_count   INTEGER NOT NULL DEFAULT 0,
  imported_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_qb_import_batches_tenant ON qb_import_batches (tenant);

ALTER TABLE qb_import_batches ENABLE ROW LEVEL SECURITY;

-- Admin-only CRUD
CREATE POLICY "qb_import_batches_admin_all"
  ON qb_import_batches FOR ALL
  TO authenticated
  USING (get_current_user_rol() = 'admin')
  WITH CHECK (get_current_user_rol() = 'admin');

-- Add FK from questions to import_batches (deferred because table order)
ALTER TABLE qb_questions
  ADD CONSTRAINT qb_questions_import_batch_fkey
  FOREIGN KEY (import_batch_id) REFERENCES qb_import_batches(id) ON DELETE SET NULL;


-- ── 7. RPC: Paginated question search with filters ────────────

CREATE OR REPLACE FUNCTION get_qb_questions(
  p_tenant TEXT,
  p_search TEXT DEFAULT NULL,
  p_category_id UUID DEFAULT NULL,
  p_tag_ids UUID[] DEFAULT NULL,
  p_type qb_question_type DEFAULT NULL,
  p_difficulty qb_difficulty DEFAULT NULL,
  p_status qb_status DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
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
  -- Verify caller is admin
  IF get_current_user_rol() != 'admin' THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  v_offset := (p_page - 1) * p_page_size;

  -- Count total matching
  SELECT count(*) INTO v_total
  FROM qb_questions q
  WHERE q.tenant = p_tenant
    AND (p_search IS NULL OR q.search_vector @@ plainto_tsquery('spanish', p_search))
    AND (p_category_id IS NULL OR q.category_id = p_category_id)
    AND (p_type IS NULL OR q.type = p_type)
    AND (p_difficulty IS NULL OR q.difficulty = p_difficulty)
    AND (p_status IS NULL OR q.status = p_status)
    AND (p_date_from IS NULL OR q.created_at >= p_date_from)
    AND (p_date_to IS NULL OR q.created_at <= p_date_to)
    AND (p_tag_ids IS NULL OR EXISTS (
      SELECT 1 FROM qb_question_tags qt
      WHERE qt.question_id = q.id AND qt.tag_id = ANY(p_tag_ids)
    ));

  -- Get paginated results
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
      q.difficulty,
      q.status,
      q.created_by,
      p.nombre AS created_by_nombre,
      p.apellido_paterno AS created_by_apellido,
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
    LEFT JOIN profiles p ON p.id = q.created_by
    WHERE q.tenant = p_tenant
      AND (p_search IS NULL OR q.search_vector @@ plainto_tsquery('spanish', p_search))
      AND (p_category_id IS NULL OR q.category_id = p_category_id)
      AND (p_type IS NULL OR q.type = p_type)
      AND (p_difficulty IS NULL OR q.difficulty = p_difficulty)
      AND (p_status IS NULL OR q.status = p_status)
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
