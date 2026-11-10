ALTER TABLE public.guest_institution_requests
  ADD COLUMN IF NOT EXISTS requested_by_user_id UUID;

CREATE INDEX IF NOT EXISTS idx_guest_institution_requests_student_user
  ON public.guest_institution_requests (requested_by_user_id, created_at DESC)
  WHERE requested_by_user_id IS NOT NULL;
