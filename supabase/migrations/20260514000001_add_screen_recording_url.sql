-- ============================================================
-- UP
-- ============================================================
ALTER TABLE response
  ADD COLUMN IF NOT EXISTS screen_recording_url TEXT;

-- ============================================================
-- DOWN  (run manually to roll back — Supabase does not execute
--        this section automatically)
-- ============================================================
-- ALTER TABLE response DROP COLUMN IF EXISTS screen_recording_url;
