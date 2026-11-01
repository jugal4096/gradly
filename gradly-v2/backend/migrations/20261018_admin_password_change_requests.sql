-- Gradly administrator application uniqueness and password-change approval workflow.
-- Run this migration against the same PostgreSQL database used by the backend.

-- Prevent one Firebase-backed user from creating multiple admin applications.
-- If historical duplicates exist, the index is intentionally skipped rather than deleting user data.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_applications
    GROUP BY user_id HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS admin_applications_one_per_user_uidx
      ON public.admin_applications (user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.admin_password_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  admin_code VARCHAR(32) NOT NULL,
  admin_email TEXT NOT NULL,
  firebase_uid TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED')),
  review_note TEXT,
  reviewed_by_super_admin_id UUID NULL,
  reviewed_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_password_change_one_pending_per_admin_uidx
  ON public.admin_password_change_requests (admin_id)
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS admin_password_change_requests_status_created_idx
  ON public.admin_password_change_requests (status, created_at DESC);
