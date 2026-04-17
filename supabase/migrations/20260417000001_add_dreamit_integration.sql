-- ============================================================
-- UP
-- ============================================================

-- Link interviews to a DreamIT bamboo job
ALTER TABLE interview
  ADD COLUMN IF NOT EXISTS job_id INTEGER,
  ADD COLUMN IF NOT EXISTS job_title TEXT;

-- Track candidate application reference and DreamIT notification state
ALTER TABLE response
  ADD COLUMN IF NOT EXISTS application_id TEXT,
  ADD COLUMN IF NOT EXISTS dreamit_notified BOOLEAN DEFAULT false;

-- ============================================================
-- DOWN  (run manually to roll back)
-- ============================================================
-- ALTER TABLE interview
--   DROP COLUMN IF EXISTS job_id,
--   DROP COLUMN IF EXISTS job_title;
-- ALTER TABLE response
--   DROP COLUMN IF EXISTS application_id,
--   DROP COLUMN IF EXISTS dreamit_notified;
