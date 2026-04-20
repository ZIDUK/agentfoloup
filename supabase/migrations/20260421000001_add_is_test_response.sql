ALTER TABLE response ADD COLUMN IF NOT EXISTS is_test_response BOOLEAN DEFAULT FALSE;

-- To drop: ALTER TABLE response DROP COLUMN IF EXISTS is_test_response;
