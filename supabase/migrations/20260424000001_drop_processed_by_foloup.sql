-- processed_by_foloup is no longer used — is_analysed alone gates all
-- analytics checks and retry cron queries.
ALTER TABLE response DROP COLUMN IF EXISTS processed_by_foloup;
