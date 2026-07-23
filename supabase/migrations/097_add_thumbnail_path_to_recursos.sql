-- ============================================================
-- 097_add_thumbnail_path_to_recursos.sql
-- Pre-generated PDF thumbnail support.
--
-- 1. Adds thumbnail_path column to recursos_compartidos
-- 2. Creates the recursos-thumbnails storage bucket
-- 3. Configures RLS policies for the bucket
-- ============================================================

-- 1. Column for storing the thumbnail storage path
ALTER TABLE public.recursos_compartidos
  ADD COLUMN IF NOT EXISTS thumbnail_path TEXT DEFAULT NULL;

COMMENT ON COLUMN public.recursos_compartidos.thumbnail_path IS
  'Storage path of the pre-generated thumbnail image (WebP) for PDF files. Stored in the recursos-thumbnails bucket.';

-- 2. Create the storage bucket (private, max 1MB, image types only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('recursos-thumbnails', 'recursos-thumbnails', false, 1048576, ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

-- 3. RLS policies for the bucket
CREATE POLICY "Authenticated users can read thumbnails"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'recursos-thumbnails');

CREATE POLICY "Service role can manage thumbnails"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'recursos-thumbnails')
  WITH CHECK (bucket_id = 'recursos-thumbnails');
