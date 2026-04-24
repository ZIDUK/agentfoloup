-- ============================================================
-- UP
-- ============================================================

CREATE TABLE interview_job (
    interview_id TEXT NOT NULL REFERENCES interview(id),
    job_id INTEGER NOT NULL,
    job_title TEXT,
    PRIMARY KEY (interview_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_interview_job_interview_id ON interview_job(interview_id);

-- Migrate existing data
INSERT INTO interview_job (interview_id, job_id, job_title)
SELECT id, job_id, job_title
FROM interview
WHERE job_id IS NOT NULL;

-- Drop old columns
ALTER TABLE interview
    DROP COLUMN IF EXISTS job_id,
    DROP COLUMN IF EXISTS job_title;

-- Store which job a candidate applied for when they took the interview
ALTER TABLE response ADD COLUMN IF NOT EXISTS job_id INTEGER;

-- ============================================================
-- DOWN  (run manually to roll back)
-- ============================================================
-- ALTER TABLE response DROP COLUMN IF EXISTS job_id;
-- ALTER TABLE interview ADD COLUMN IF NOT EXISTS job_id INTEGER, ADD COLUMN IF NOT EXISTS job_title TEXT;
-- UPDATE interview i SET job_id = ij.job_id, job_title = ij.job_title FROM interview_job ij WHERE ij.interview_id = i.id;
-- DROP TABLE IF EXISTS interview_job;
