-- ============================================================
-- Migration 056: content bucket + storage policies
-- Run this in the Supabase SQL Editor of your production project.
-- ============================================================

-- 1. Create the public 'content' bucket (skip if already exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'content',
  'content',
  true,
  10485760,
  ARRAY[
    'text/markdown',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml'
  ]
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Public read (anon + authenticated)
DROP POLICY IF EXISTS "content_public_read" ON storage.objects;
CREATE POLICY "content_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'content');

-- 3. Authenticated write policies
DROP POLICY IF EXISTS "content_auth_insert" ON storage.objects;
CREATE POLICY "content_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'content');

DROP POLICY IF EXISTS "content_auth_update" ON storage.objects;
CREATE POLICY "content_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'content')
  WITH CHECK (bucket_id = 'content');

DROP POLICY IF EXISTS "content_auth_delete" ON storage.objects;
CREATE POLICY "content_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'content');
