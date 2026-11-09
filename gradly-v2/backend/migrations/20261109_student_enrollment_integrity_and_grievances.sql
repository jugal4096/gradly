-- Student identity integrity, confirmed academic progression and enrollment grievances.
BEGIN;

ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS predicted_semester_number SMALLINT,
  ADD COLUMN IF NOT EXISTS academic_gap_years SMALLINT,
  ADD COLUMN IF NOT EXISTS academic_profile_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_profiles_predicted_semester_check') THEN
    ALTER TABLE public.student_profiles ADD CONSTRAINT student_profiles_predicted_semester_check
      CHECK (predicted_semester_number IS NULL OR predicted_semester_number BETWEEN 1 AND 20);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_profiles_academic_gap_years_check') THEN
    ALTER TABLE public.student_profiles ADD CONSTRAINT student_profiles_academic_gap_years_check
      CHECK (academic_gap_years IS NULL OR academic_gap_years BETWEEN 0 AND 10);
  END IF;
END $$;

-- Do not silently choose an owner if historical data already contains duplicates.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.student_profiles
    WHERE NULLIF(BTRIM(student_identifier), '') IS NOT NULL
    GROUP BY LOWER(BTRIM(student_identifier))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce unique enrollment ownership: duplicate student identifiers already exist. Resolve duplicates before rerunning this migration.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.student_profiles
    GROUP BY user_id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one profile per student account: duplicate user_id records already exist. Resolve them before rerunning this migration.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS student_profiles_enrollment_identifier_unique_idx
  ON public.student_profiles (LOWER(BTRIM(student_identifier)));
CREATE UNIQUE INDEX IF NOT EXISTS student_profiles_user_id_unique_idx
  ON public.student_profiles (user_id);

CREATE TABLE IF NOT EXISTS public.student_enrollment_grievances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE RESTRICT,
  enrollment_number VARCHAR(32),
  category VARCHAR(40) NOT NULL CHECK (category IN (
    'INVALID_ENROLLMENT','ALREADY_REGISTERED','WRONG_PROGRAMME','WRONG_SCHEME',
    'WRONG_BRANCH','WRONG_ADMISSION_MODE','WRONG_SEMESTER','OTHER'
  )),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 10 AND 3000),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','IN_REVIEW','NEEDS_INFO','RESOLVED','REJECTED')),
  admin_note TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS student_enrollment_grievances_status_created_idx
  ON public.student_enrollment_grievances (status, created_at DESC);
CREATE INDEX IF NOT EXISTS student_enrollment_grievances_student_created_idx
  ON public.student_enrollment_grievances (student_user_id, created_at DESC);

-- Programme aliases must not cross-map BE and BT degree identities.
UPDATE public.enrollment_program_rules
SET programme_alias_patterns = '{}'::text[]
WHERE institution_id IS NULL AND prefix IN ('BE','BT');

COMMIT;
