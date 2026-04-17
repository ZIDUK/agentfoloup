-- ============================================================
-- UP
-- ============================================================

ALTER TABLE response
  ADD COLUMN IF NOT EXISTS processed_by_foloup BOOLEAN DEFAULT false;

-- Index to make the cron retry query fast
CREATE INDEX IF NOT EXISTS idx_response_retry_dreamit
  ON response (processed_by_foloup, dreamit_notified)
  WHERE processed_by_foloup = true AND dreamit_notified = false;

-- ============================================================
-- DOWN  (run manually to roll back)
-- ============================================================
-- DROP INDEX IF EXISTS idx_response_retry_dreamit;
-- ALTER TABLE response DROP COLUMN IF EXISTS processed_by_foloup;
