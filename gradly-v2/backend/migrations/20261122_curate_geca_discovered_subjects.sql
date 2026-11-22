-- Curated GECA NEP subject metadata corrections and verified discovered entries.
UPDATE public.curriculum_subjects
   SET course_name='Python Programming', updated_at=now()
 WHERE course_code='CEVSE2001';

UPDATE public.subjects s
   SET canonical_name='Python Programming', updated_at=now()
 WHERE s.id IN (
   SELECT subject_id FROM public.curriculum_subjects WHERE course_code='CEVSE2001'
 );

INSERT INTO public.discovered_result_subjects
  (curriculum_id,course_code,course_name,course_category,credits,credit_status,source,semester_number)
SELECT 'fe6ea8f1-7be9-5bde-9c17-197c3fa8fdf5'::uuid,
       'INMDM1002','Corporate Social Responsibility','MDM',3,
       'FIRST_USER_CONFIRMED','GECA_ENTC_SEM4_REGISTRATION_FORM_2025',4
WHERE EXISTS (
  SELECT 1 FROM public.semesters
   WHERE curriculum_id='fe6ea8f1-7be9-5bde-9c17-197c3fa8fdf5'::uuid AND semester_number=4
)
ON CONFLICT (curriculum_id,course_code)
DO UPDATE SET course_name=EXCLUDED.course_name,
              course_category=EXCLUDED.course_category,
              credits=EXCLUDED.credits,
              source=EXCLUDED.source,
              semester_number=EXCLUDED.semester_number,
              updated_at=now();

INSERT INTO public.discovered_result_subjects
  (curriculum_id,course_code,course_name,course_category,credits,credit_status,source,semester_number)
SELECT '744e9947-4f22-abf9-3480-579b37b5fb6c'::uuid,
       'CSMDM5003','Multidisciplinary Minor','MDM',3,
       'SUPER_ADMIN_VERIFIED','GECA_OFFICIAL_CSE_NEP_SYLLABUS',4
WHERE EXISTS (
  SELECT 1 FROM public.semesters
   WHERE curriculum_id='744e9947-4f22-abf9-3480-579b37b5fb6c'::uuid AND semester_number=4
)
ON CONFLICT (curriculum_id,course_code)
DO UPDATE SET course_name=EXCLUDED.course_name,
              course_category=EXCLUDED.course_category,
              credits=EXCLUDED.credits,
              credit_status='SUPER_ADMIN_VERIFIED',
              source=EXCLUDED.source,
              semester_number=EXCLUDED.semester_number,
              updated_at=now();
