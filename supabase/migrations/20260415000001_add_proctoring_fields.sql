-- ============================================================
-- UP
-- ============================================================
-- Add proctoring and camera recording fields to response table
ALTER TABLE response
  ADD COLUMN IF NOT EXISTS recording_url TEXT,
  ADD COLUMN IF NOT EXISTS fullscreen_exit_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proctoring_events JSONB DEFAULT '[]'::jsonb;

-- ============================================================
-- DOWN  (run manually to roll back — Supabase does not execute
--        this section automatically)
-- ============================================================
-- ALTER TABLE response
--   DROP COLUMN IF EXISTS recording_url,
--   DROP COLUMN IF EXISTS fullscreen_exit_count,
--   DROP COLUMN IF EXISTS proctoring_events;
