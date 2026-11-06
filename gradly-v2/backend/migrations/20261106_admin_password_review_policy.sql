-- Admin passwords are no longer expired automatically after one month.
-- Before this policy, password_expires_at was populated automatically on
-- account creation and password changes. Clear those legacy timestamps so
-- existing administrators are not unexpectedly locked out by the new policy.
-- From this migration onward, only the explicit Super Admin action sets this
-- column to a timestamp.

UPDATE public.admins
SET password_expires_at = NULL,
    updated_at = NOW()
WHERE password_expires_at IS NOT NULL;
