-- ============================================================
-- UP
-- ============================================================

-- Drop the full unique constraint and NOT NULL — replaced below.
ALTER TABLE response
  DROP CONSTRAINT IF EXISTS response_application_id_unique;

ALTER TABLE response
  ALTER COLUMN application_id DROP NOT NULL;

-- Require application_id for all non-test responses.
-- Run the cleanup query first before applying this migration:
--   DELETE FROM response WHERE application_id IS NULL AND (is_test_response IS NULL OR is_test_response = false);
ALTER TABLE response
  ADD CONSTRAINT response_application_id_required
  CHECK (is_test_response = true OR application_id IS NOT NULL);

-- Partial unique index — test responses (application_id IS NULL) are excluded.
CREATE UNIQUE INDEX idx_response_unique_application_id
  ON response (application_id)
  WHERE application_id IS NOT NULL;

-- ============================================================
-- DOWN  (run manually to roll back)
-- ============================================================
-- DROP INDEX IF EXISTS idx_response_unique_application_id;
-- ALTER TABLE response DROP CONSTRAINT response_application_id_required;
-- ALTER TABLE response ALTER COLUMN application_id SET NOT NULL;
-- ALTER TABLE response ADD CONSTRAINT response_application_id_unique UNIQUE (application_id);
