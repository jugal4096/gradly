-- GECA M.Tech: backfill missing semester display names.
-- Safe/idempotent: updates only NULL names for semesters 1-4 in the
-- verified GECA Master of Technology programme. Does not publish curricula,
-- alter semester numbering, add subjects, or invent syllabus content.

BEGIN;

UPDATE public.semesters AS s
SET
  name = CASE s.semester_number
    WHEN 1 THEN 'Semester I'
    WHEN 2 THEN 'Semester II'
    WHEN 3 THEN 'Semester III'
    WHEN 4 THEN 'Semester IV'
  END,
  updated_at = NOW()
FROM public.curricula AS c
WHERE c.id = s.curriculum_id
  AND c.institution_id = '0072cf6d-55a1-54e1-9a8c-767d8058f60a'::uuid
  AND c.program_id = 'a4f77a0a-02e1-4c54-9f75-7b913f60a001'::uuid
  AND s.semester_number BETWEEN 1 AND 4
  AND s.name IS NULL;

COMMIT;

-- Verify:
-- SELECT c.id AS curriculum_id, sp.code AS specialization_code,
--        s.semester_number, s.name
-- FROM public.curricula c
-- LEFT JOIN public.specializations sp ON sp.id = c.specialization_id
-- JOIN public.semesters s ON s.curriculum_id = c.id
-- WHERE c.institution_id = '0072cf6d-55a1-54e1-9a8c-767d8058f60a'::uuid
--   AND c.program_id = 'a4f77a0a-02e1-4c54-9f75-7b913f60a001'::uuid
-- ORDER BY sp.code, s.semester_number;
