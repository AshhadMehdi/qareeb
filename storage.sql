-- Run in Supabase SQL Editor after schema.sql. Images are PUBLIC, not private documents.
-- No browser INSERT/UPDATE/DELETE policy: only the authenticated Vercel API uploads
-- using the server-only service_role key. Never put that key in VITE_* variables.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('qareeb-images', 'qareeb-images', true, 3145728, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
