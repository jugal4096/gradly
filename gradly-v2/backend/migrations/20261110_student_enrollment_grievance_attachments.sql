BEGIN;

CREATE TABLE IF NOT EXISTS public.student_enrollment_grievance_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grievance_id UUID NOT NULL UNIQUE REFERENCES public.student_enrollment_grievances(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(80) NOT NULL CHECK (content_type IN ('application/pdf','image/jpeg','image/png')),
  file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes BETWEEN 1 AND 5242880),
  file_data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS student_enrollment_grievance_attachments_created_idx
  ON public.student_enrollment_grievance_attachments (created_at DESC);

-- Evidence is served only by authenticated backend endpoints, never the public Data API.
ALTER TABLE public.student_enrollment_grievance_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.student_enrollment_grievance_attachments FROM anon, authenticated;

COMMIT;
