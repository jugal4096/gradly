-- Allow Super Admin to choose the date an approved administrator's access expires.
-- The applicant's graduation date is the default in the review UI.
ALTER TABLE public.admin_applications
  ADD COLUMN IF NOT EXISTS adminship_expiry_date DATE;

ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS adminship_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_admin_applications_adminship_expiry
  ON public.admin_applications (adminship_expiry_date)
  WHERE adminship_expiry_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admins_adminship_expires_at
  ON public.admins (adminship_expires_at)
  WHERE adminship_expires_at IS NOT NULL;
