-- Keep a stable course identifier separate from the department-level course code.
-- Existing course_id values are initialized from the current course_code.
-- Later edits to course_code do not overwrite course_id.

BEGIN;

ALTER TABLE public.curriculum_subjects
  ADD COLUMN IF NOT EXISTS course_id TEXT;

UPDATE public.curriculum_subjects
SET course_id = course_code
WHERE course_id IS NULL OR btrim(course_id) = '';

ALTER TABLE public.curriculum_subjects
  ALTER COLUMN course_id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_curriculum_subject_course_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Initialize only when a new row has no explicit stable identifier.
  -- Do not replace course_id when course_code changes later.
  IF NEW.course_id IS NULL OR btrim(NEW.course_id) = '' THEN
    NEW.course_id := NEW.course_code;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_curriculum_subject_course_id
  ON public.curriculum_subjects;

CREATE TRIGGER trg_set_curriculum_subject_course_id
BEFORE INSERT ON public.curriculum_subjects
FOR EACH ROW
EXECUTE FUNCTION public.set_curriculum_subject_course_id();

COMMENT ON COLUMN public.curriculum_subjects.course_id IS
  'Stable internal course identifier; backfilled from the previous course_code. Department-level code is stored in course_code.';

COMMENT ON COLUMN public.curriculum_subjects.course_code IS
  'Department-level / official course code. Editing this does not change course_id.';

COMMIT;
