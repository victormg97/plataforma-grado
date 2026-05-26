-- =============================================================
-- 023_recursos_storage.sql
-- Private Supabase Storage bucket for uploaded resource files
-- =============================================================

-- Create private bucket (public = false means files need signed URLs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recursos',
  'recursos',
  false,
  52428800,  -- 50 MB limit
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'video/mp4',
    'video/webm',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- -------------------------------------------------------
-- ADMIN: full access to entire bucket
-- -------------------------------------------------------
CREATE POLICY "recursos: admin full access"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'recursos'
    AND (SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    bucket_id = 'recursos'
    AND (SELECT rol FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- -------------------------------------------------------
-- PROFESOR: upload only to their own folder ({user_id}/...)
-- -------------------------------------------------------
CREATE POLICY "recursos: profesor upload own folder"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'recursos'
    AND (SELECT rol FROM profiles WHERE id = auth.uid()) = 'profesor'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "recursos: profesor read own folder"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'recursos'
    AND (SELECT rol FROM profiles WHERE id = auth.uid()) = 'profesor'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "recursos: profesor delete own folder"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'recursos'
    AND (SELECT rol FROM profiles WHERE id = auth.uid()) = 'profesor'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- -------------------------------------------------------
-- ALUMNO: read-only, but ONLY files they have access to.
-- Since we cannot easily join storage.objects with recursos_compartidos
-- in a storage policy, alumno downloads are handled via a server-side
-- API route that:
--   1. Verifies the alumno has access via recursos_compartidos RLS
--   2. Generates a short-lived signed URL using the service-role client
--
-- Therefore, we do NOT add a direct alumno SELECT policy on storage.objects.
-- The API route at /api/recursos/[id]/download handles this securely.
-- -------------------------------------------------------
