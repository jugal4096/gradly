-- Preserve expected progression separately from student-confirmed/verified status.
ALTER TABLE public.student_profiles
  ALTER COLUMN current_semester_number DROP NOT NULL;

ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS academic_status VARCHAR(32) NOT NULL DEFAULT 'ENROLLED';

ALTER TABLE public.student_profiles
  DROP CONSTRAINT IF EXISTS student_profiles_academic_status_check;

ALTER TABLE public.student_profiles
  ADD CONSTRAINT student_profiles_academic_status_check
  CHECK (academic_status IN ('ENROLLED','AWAITING_RESULTS','PENDING_BACKLOGS','APPROVED_EXTENSION','GRADUATED'));

ALTER TABLE public.student_profiles
  ADD CONSTRAINT student_profiles_semester_status_check
  CHECK (
    (academic_status IN ('ENROLLED','APPROVED_EXTENSION','PENDING_BACKLOGS') AND current_semester_number IS NOT NULL)
    OR
    (academic_status IN ('AWAITING_RESULTS','GRADUATED') AND current_semester_number IS NULL)
  ) NOT VALID;
