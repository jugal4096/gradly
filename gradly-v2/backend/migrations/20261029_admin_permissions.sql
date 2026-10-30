-- Per-administrator permission grants used by the Super Admin governance screen.
-- Permission enforcement must be wired into protected admin routes before relying on
-- these grants as an authorization boundary.
CREATE TABLE IF NOT EXISTS public.admin_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  permission_code varchar(100) NOT NULL,
  granted boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (admin_id, permission_code)
);
CREATE INDEX IF NOT EXISTS idx_admin_permissions_admin
  ON public.admin_permissions (admin_id);

-- A recipient can read only their own notices.
CREATE INDEX IF NOT EXISTS idx_admin_notices_admin_unread
  ON public.admin_notices (admin_id, created_at DESC)
  WHERE read_at IS NULL;
