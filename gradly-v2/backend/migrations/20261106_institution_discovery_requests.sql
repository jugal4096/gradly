-- Expanded institution discovery and request lifecycle.
ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS institution_type TEXT,
  ADD COLUMN IF NOT EXISTS affiliation TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS aishe_code TEXT;
CREATE INDEX IF NOT EXISTS idx_institutions_state_city ON public.institutions (state, city);
ALTER TABLE public.guest_institution_requests
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS institution_type TEXT,
  ADD COLUMN IF NOT EXISTS affiliation TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS additional_info TEXT,
  ADD COLUMN IF NOT EXISTS requester_uid TEXT,
  ADD COLUMN IF NOT EXISTS requester_email TEXT,
  ADD COLUMN IF NOT EXISTS requester_name TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_note TEXT,
  ADD COLUMN IF NOT EXISTS directory_institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_guest_institution_requests_requester
  ON public.guest_institution_requests (requester_uid, created_at DESC)
  WHERE requester_uid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guest_institution_requests_email
  ON public.guest_institution_requests (lower(requester_email), created_at DESC)
  WHERE requester_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guest_institution_requests_dedupe
  ON public.guest_institution_requests (lower(college_name), lower(locality), created_at DESC)
  WHERE status IN ('PENDING','IN_REVIEW');

