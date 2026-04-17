-- ============================================================
-- UP
-- ============================================================

-- One response per application_id. NULLs are excluded so non-DreamIT
-- interviews (no application_id) are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS idx_response_unique_application_id
  ON response (application_id)
  WHERE application_id IS NOT NULL;

-- ============================================================
-- DOWN  (run manually to roll back)
-- ============================================================
-- DROP INDEX IF EXISTS idx_response_unique_application_id;
