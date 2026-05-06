CREATE TABLE invitations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id    text        NOT NULL REFERENCES interview(id),
  application_id  text        NOT NULL UNIQUE,
  job_id          integer,
  candidate_email text        NOT NULL,
  candidate_name  text,
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  is_started      boolean     NOT NULL DEFAULT false,
  is_submitted    boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE invitations DISABLE ROW LEVEL SECURITY;

CREATE INDEX idx_invitations_interview_id    ON invitations(interview_id);
CREATE INDEX idx_invitations_application_id  ON invitations(application_id);
CREATE INDEX idx_invitations_candidate_email ON invitations(candidate_email);
