-- ============================================================
-- UP
-- ============================================================

-- Remove duplicate application_id rows, keeping the most recently created one.
DELETE FROM response
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY application_id
             ORDER BY created_at DESC, id DESC
           ) AS rn
    FROM response
    WHERE application_id IS NOT NULL
  ) dupes
  WHERE rn > 1
);

-- One response per application_id. NULLs are excluded so non-DreamIT
-- interviews (no application_id) are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS idx_response_unique_application_id
  ON response (application_id)
  WHERE application_id IS NOT NULL;

-- ============================================================
-- DOWN  (run manually to roll back)
-- ============================================================
-- DROP INDEX IF EXISTS idx_response_unique_application_id;
