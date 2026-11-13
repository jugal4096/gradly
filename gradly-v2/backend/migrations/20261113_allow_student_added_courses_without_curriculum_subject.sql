-- Student-added elective and additional courses are stored with immutable snapshots.
-- They may not exist in the shared curriculum catalogue, so the curriculum link is optional.
ALTER TABLE public.student_semester_courses
  ALTER COLUMN curriculum_subject_id DROP NOT NULL;
