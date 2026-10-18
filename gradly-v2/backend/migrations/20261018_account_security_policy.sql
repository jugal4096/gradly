-- Gradly account security: fixed 12-hour lockout, password expiry, and Super Admin alerts.
ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_expires_at TIMESTAMPTZ;

UPDATE public.admins
SET password_changed_at = COALESCE(password_changed_at, updated_at, created_at, NOW()),
    password_expires_at = COALESCE(password_expires_at, COALESCE(password_changed_at, updated_at, created_at, NOW()) + INTERVAL '1 month')
WHERE password_changed_at IS NULL OR password_expires_at IS NULL;

ALTER TABLE public.super_admins
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_expires_at TIMESTAMPTZ;

UPDATE public.super_admins
SET password_changed_at = COALESCE(password_changed_at, updated_at, created_at, NOW()),
    password_expires_at = COALESCE(password_expires_at, COALESCE(password_changed_at, updated_at, created_at, NOW()) + INTERVAL '1 month')
WHERE password_changed_at IS NULL OR password_expires_at IS NULL;

-- Security events are persisted for the Super Admin in-app notification queue.
CREATE TABLE IF NOT EXISTS public.security_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('ADMIN_LOCKOUT', 'SUPER_ADMIN_LOCKOUT')),
  principal_type TEXT NOT NULL CHECK (principal_type IN ('ADMIN', 'SUPER_ADMIN')),
  principal_id UUID NOT NULL,
  principal_code TEXT NOT NULL,
  principal_name TEXT,
  principal_email TEXT,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'REVOKED')),
  locked_until TIMESTAMPTZ,
  reviewed_by_super_admin_id UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS security_notifications_status_created_idx
  ON public.security_notifications (status, created_at DESC);

-- Ensure existing login security rows use a three-attempt limit.
UPDATE public.login_security
SET attempt_limit = 3,
    failed_attempts = 0,
    lockout_level = 0,
    locked_until = NULL,
    updated_at = NOW()
WHERE locked_until IS NULL OR locked_until <= NOW();
