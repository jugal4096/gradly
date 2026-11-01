-- Allow a user to submit a fresh admin application after an administrator account is removed.
-- Rejected applications remain in history; only one non-rejected application per user is allowed.

DROP INDEX IF EXISTS public.admin_applications_one_per_user_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS admin_applications_one_active_per_user_uidx
  ON public.admin_applications (user_id)
  WHERE status <> 'REJECTED';
