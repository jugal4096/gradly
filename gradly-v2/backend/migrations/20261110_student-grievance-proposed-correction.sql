ALTER TABLE public.student_enrollment_grievances
  ADD COLUMN IF NOT EXISTS proposed_correction TEXT;

ALTER TABLE public.student_enrollment_grievances
  DROP CONSTRAINT IF EXISTS student_enrollment_grievances_proposed_correction_length_check;

ALTER TABLE public.student_enrollment_grievances
  ADD CONSTRAINT student_enrollment_grievances_proposed_correction_length_check
  CHECK (
    proposed_correction IS NULL
    OR char_length(proposed_correction) BETWEEN 2 AND 500
  );
