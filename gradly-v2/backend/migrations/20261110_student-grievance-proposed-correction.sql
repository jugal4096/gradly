-- Upgrade the legacy student grievance table to the academic identity review contract.
-- Existing legacy rows are preserved; this migration stops rather than assigning an institution
-- or category to historical records without a reliable source.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.student_enrollment_grievances
    WHERE institution_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Legacy enrollment grievances exist without an institution_id. Reconcile those records before applying this migration.';
  END IF;
END $$;

ALTER TABLE public.student_enrollment_grievances
  ADD COLUMN IF NOT EXISTS institution_id UUID,
  ADD COLUMN IF NOT EXISTS enrollment_number VARCHAR(32),
  ADD COLUMN IF NOT EXISTS category VARCHAR(40),
  ADD COLUMN IF NOT EXISTS admin_note TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proposed_correction TEXT;

-- This project currently has no legacy grievance rows. Keep compatibility for future reruns
-- while enforcing required institution/category values for all newly submitted grievances.
UPDATE public.student_enrollment_grievances
SET category = CASE
  WHEN UPPER(COALESCE(grievance_type, '')) IN (
    'INVALID_ENROLLMENT','ALREADY_REGISTERED','WRONG_PROGRAMME','WRONG_SCHEME',
    'WRONG_BRANCH','WRONG_SPECIALIZATION','WRONG_ADMISSION_MODE','WRONG_SEMESTER','OTHER'
  ) THEN UPPER(grievance_type)
  ELSE 'OTHER'
END
WHERE category IS NULL;

UPDATE public.student_enrollment_grievances
SET admin_note = admin_response
WHERE admin_note IS NULL AND admin_response IS NOT NULL;

UPDATE public.student_enrollment_grievances
SET status = UPPER(status)
WHERE status <> UPPER(status);

ALTER TABLE public.student_enrollment_grievances
  ALTER COLUMN institution_id SET NOT NULL,
  ALTER COLUMN category SET DEFAULT 'OTHER',
  ALTER COLUMN category SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'PENDING';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'student_enrollment_grievances_institution_id_fkey'
      AND conrelid = 'public.student_enrollment_grievances'::regclass
  ) THEN
    ALTER TABLE public.student_enrollment_grievances
      ADD CONSTRAINT student_enrollment_grievances_institution_id_fkey
      FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'student_enrollment_grievances_student_user_id_fkey'
      AND conrelid = 'public.student_enrollment_grievances'::regclass
  ) THEN
    ALTER TABLE public.student_enrollment_grievances
      ADD CONSTRAINT student_enrollment_grievances_student_user_id_fkey
      FOREIGN KEY (student_user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.student_enrollment_grievances
  DROP CONSTRAINT IF EXISTS student_enrollment_grievances_category_check,
  ADD CONSTRAINT student_enrollment_grievances_category_check
    CHECK (category IN (
      'INVALID_ENROLLMENT','ALREADY_REGISTERED','WRONG_PROGRAMME','WRONG_SCHEME',
      'WRONG_BRANCH','WRONG_SPECIALIZATION','WRONG_ADMISSION_MODE','WRONG_SEMESTER','OTHER'
    )),
  DROP CONSTRAINT IF EXISTS student_enrollment_grievances_status_check,
  ADD CONSTRAINT student_enrollment_grievances_status_check
    CHECK (status IN ('PENDING','IN_REVIEW','NEEDS_INFO','RESOLVED','REJECTED')),
  DROP CONSTRAINT IF EXISTS student_enrollment_grievances_proposed_correction_length_check,
  ADD CONSTRAINT student_enrollment_grievances_proposed_correction_length_check
    CHECK (proposed_correction IS NULL OR char_length(proposed_correction) BETWEEN 2 AND 500);

CREATE INDEX IF NOT EXISTS student_enrollment_grievances_institution_status_created_idx
  ON public.student_enrollment_grievances (institution_id, status, created_at DESC);
