ALTER TABLE public.guest_institution_requests
  ADD COLUMN IF NOT EXISTS tracking_token_hash TEXT;

CREATE INDEX IF NOT EXISTS guest_institution_requests_tracking_token_idx
  ON public.guest_institution_requests (tracking_token_hash)
  WHERE tracking_token_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS guest_institution_requests_guest_id_active_unique_idx
  ON public.guest_institution_requests (lower(guest_id))
  WHERE guest_id IS NOT NULL AND status IN ('PENDING','IN_REVIEW');
