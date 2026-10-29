-- Apply once to the Gradly PostgreSQL database before enabling targeted administrator notices.
-- Notices are persisted per administrator; this is in-app inbox storage, not email/SMS.
CREATE TABLE IF NOT EXISTS public.admin_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.admins(id) ON DELETE RESTRICT,
  title varchar(160) NOT NULL,
  body varchar(5000) NOT NULL,
  created_by_super_admin_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  read_at timestamptz NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_notices_admin_created
  ON public.admin_notices (admin_id, created_at DESC);
