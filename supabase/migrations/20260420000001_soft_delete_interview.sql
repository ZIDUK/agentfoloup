-- ============================================================
-- UP
-- ============================================================

ALTER TABLE interview ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- ============================================================
-- DOWN  (run manually to roll back)
-- ============================================================
-- ALTER TABLE interview DROP COLUMN IF EXISTS is_deleted;
