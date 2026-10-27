CREATE TABLE IF NOT EXISTS public.guest_institution_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_name TEXT NOT NULL CHECK (char_length(college_name) BETWEEN 2 AND 160),
  locality TEXT NOT NULL CHECK (char_length(locality) BETWEEN 2 AND 160),
  guest_id TEXT,
  external_institution_id TEXT,
  source TEXT NOT NULL DEFAULT 'GUEST_SETUP',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','IN_REVIEW','RESOLVED','REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by_super_admin_id UUID
);
CREATE INDEX IF NOT EXISTS idx_guest_institution_requests_status_created
  ON public.guest_institution_requests (status, created_at DESC);

ALTER TABLE public.guest_institution_requests
  ADD COLUMN IF NOT EXISTS email TEXT;
