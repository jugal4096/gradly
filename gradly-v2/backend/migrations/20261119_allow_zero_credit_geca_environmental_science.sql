-- GECA's New CBCS IT curriculum stores Environmental Science as
-- INMC2001 with zero credits. Preserve its result grade without affecting SGPA.
ALTER TABLE public.student_semester_courses
  DROP CONSTRAINT IF EXISTS student_semester_courses_credits_check;

ALTER TABLE public.student_semester_courses
  ADD CONSTRAINT student_semester_courses_credits_check
  CHECK (
    credits > 0
    OR (
      credits = 0
      AND course_code_snapshot IN ('INMC2001', 'INMC2010')
    )
  );
