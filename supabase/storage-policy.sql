-- Model storage bucket (Backend Spec §3.2's OTA source) — confirm it is
-- NOT publicly readable; access must be via signed URL only.
UPDATE storage.buckets SET public = false WHERE id = 'models';

CREATE POLICY "models_service_role_only" ON storage.objects
  FOR ALL USING (bucket_id = 'models' AND auth.role() = 'service_role');
-- Devices never authenticate as a real Supabase Auth user (they use the
-- custom device-secret scheme, Backend Spec §2) — model downloads happen
-- exclusively via the signed URL the /models/latest Edge Function issues,
-- never a direct authenticated bucket read.
