-- Remove organization linkage from interview table, then drop organization table and plan enum

-- Drop index on interview organization foreign key
DROP INDEX IF EXISTS idx_interview_organization_id;

-- Remove organization_id from interview table
ALTER TABLE interview DROP COLUMN IF EXISTS organization_id;

-- Drop organization table
DROP TABLE IF EXISTS organization;

-- Drop plan enum type
DROP TYPE IF EXISTS plan;


-- ============================================================
-- ROLLBACK (run these statements in order to reverse this migration)
-- ============================================================
--
-- CREATE TYPE plan AS ENUM ('free', 'pro', 'free_trial_over');
--
-- CREATE TABLE organization (
--     id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
--     name TEXT,
--     image_url TEXT,
--     allowed_responses_count INTEGER,
--     plan plan
-- );
--
-- ALTER TABLE interview ADD COLUMN organization_id TEXT REFERENCES organization(id);
--
-- CREATE INDEX idx_interview_organization_id ON interview(organization_id);
-- ============================================================
