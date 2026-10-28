-- Student self-service profile lifecycle.
-- Deletion is intentionally a soft delete: academic records and audit history remain
-- available to Super Admins for governance and support.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS gap_years INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'student_profiles_gap_years_nonnegative'
      AND conrelid = 'public.student_profiles'::regclass
  ) THEN
    ALTER TABLE public.student_profiles
      ADD CONSTRAINT student_profiles_gap_years_nonnegative CHECK (gap_years >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_student_deleted_at
  ON public.users (deleted_at DESC)
  WHERE role = 'STUDENT' AND deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_student_lifecycle
  ON public.audit_logs (entity_table, entity_id, created_at DESC)
  WHERE entity_table IN ('users', 'student_profiles');
