ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS academic_status TEXT NOT NULL DEFAULT 'ENROLLED';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'student_profiles_academic_status_check'
      AND conrelid = 'public.student_profiles'::regclass
  ) THEN
    ALTER TABLE public.student_profiles
      ADD CONSTRAINT student_profiles_academic_status_check
      CHECK (
        academic_status IN (
          'ENROLLED',
          'AWAITING_RESULTS',
          'PENDING_BACKLOGS',
          'APPROVED_EXTENSION',
          'GRADUATED'
        )
      );
  END IF;
END $$;
