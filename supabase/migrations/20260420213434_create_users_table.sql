-- Drop old thin auth-linkage table (organization relationship no longer needed)
ALTER TABLE IF EXISTS public.interview DROP CONSTRAINT IF EXISTS interview_user_id_fkey;
DROP INDEX IF EXISTS idx_user_organization_id;
DROP TABLE IF EXISTS public."user";

-- Users table for BambooHR employee sync
CREATE TABLE IF NOT EXISTS public.users (
  id                uuid        NOT NULL DEFAULT gen_random_uuid(),
  email             text        NULL,
  name              text        NOT NULL,
  bamboo_id         integer     NULL,
  role              text        NOT NULL DEFAULT 'member',
  job_title         text        NULL,
  department        text        NOT NULL DEFAULT 'Engineering',
  employee_photo    text        NULL,
  employment_status text        NOT NULL DEFAULT 'active',
  created_at        timestamptz NULL DEFAULT now(),
  updated_at        timestamptz NULL DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_email_key UNIQUE (email),
  CONSTRAINT uk_users_bamboo_id UNIQUE (bamboo_id)
);

-- Storage bucket for mirrored employee photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-photos', 'employee-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow service role to manage employee photos (edge function uses service role key)
CREATE POLICY "service role can manage employee photos"
  ON storage.objects FOR ALL
  USING (bucket_id = 'employee-photos');
