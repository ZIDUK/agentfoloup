ALTER TABLE response
  ADD COLUMN invitation_id uuid NULL
  REFERENCES invitations(id) ON DELETE SET NULL;

UPDATE response r
SET invitation_id = (
  SELECT i.id
  FROM invitations i
  WHERE i.application_id = r.application_id
  ORDER BY i.created_at DESC
  LIMIT 1
)
WHERE r.application_id IS NOT NULL
  AND r.invitation_id IS NULL;

CREATE INDEX idx_response_invitation_id ON response(invitation_id);
