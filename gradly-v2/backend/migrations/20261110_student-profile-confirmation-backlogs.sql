ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS academic_profile_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pending_backlog_count INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'student_profiles_pending_backlog_count_check'
      AND conrelid = 'public.student_profiles'::regclass
  ) THEN
    ALTER TABLE public.student_profiles
      ADD CONSTRAINT student_profiles_pending_backlog_count_check
      CHECK (
        pending_backlog_count IS NULL
        OR pending_backlog_count BETWEEN 0 AND 100
      );
  END IF;
END $$;
