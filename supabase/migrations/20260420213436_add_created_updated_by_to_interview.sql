ALTER TABLE interview
  ADD COLUMN IF NOT EXISTS created_by uuid NULL REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_by uuid NULL REFERENCES users(id);
