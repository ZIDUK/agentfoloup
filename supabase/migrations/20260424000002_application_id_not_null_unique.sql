-- ============================================================
-- UP
-- ============================================================

-- Drop the old partial unique index (only covered non-null values).
DROP INDEX IF EXISTS idx_response_unique_application_id;

-- Enforce NOT NULL — run the cleanup query first before applying this migration:
--   DELETE FROM response WHERE application_id IS NULL;
ALTER TABLE response
  ALTER COLUMN application_id SET NOT NULL;

-- Full unique constraint now that nulls are no longer allowed.
ALTER TABLE response
  ADD CONSTRAINT response_application_id_unique UNIQUE (application_id);

-- ============================================================
-- DOWN  (run manually to roll back)
-- ============================================================
-- ALTER TABLE response DROP CONSTRAINT response_application_id_unique;
-- ALTER TABLE response ALTER COLUMN application_id DROP NOT NULL;
-- CREATE UNIQUE INDEX idx_response_unique_application_id ON response (application_id) WHERE application_id IS NOT NULL;
