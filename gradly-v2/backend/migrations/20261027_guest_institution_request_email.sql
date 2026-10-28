ALTER TABLE public.guest_institution_requests
  ADD COLUMN IF NOT EXISTS email TEXT;
