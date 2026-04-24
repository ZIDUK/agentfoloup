ALTER TABLE interview_job
  ADD COLUMN dreamit_synced boolean NOT NULL DEFAULT false,
  ADD COLUMN pending_removal boolean NOT NULL DEFAULT false,
  ADD COLUMN dreamit_retry_count integer NOT NULL DEFAULT 0;

-- Existing rows are already synced with DreamIT
UPDATE interview_job SET dreamit_synced = true;
