-- GECA M.Tech Geotechnical Engineering: NEP curriculum header.
-- This deliberately creates a DRAFT header only. No syllabus/course rows or
-- credit totals are invented; import the official GECA course structure after
-- it has been checked against the source curriculum.
-- Apply through the institution's normal migration process; GitHub does not
-- execute this SQL against the live database.

BEGIN;

WITH target AS (
  SELECT
    p.id AS program_id,
    p.institution_id,
    b.id AS branch_id,
    sp.id AS specialization_id
  FROM public.programs p
  JOIN public.branches b
    ON b.program_id = p.id
   AND UPPER(BTRIM(b.name)) = 'CIVIL'
  JOIN public.specializations sp
    ON sp.program_id = p.id
   AND sp.branch_id = b.id
   AND UPPER(BTRIM(sp.code)) = 'GTE'
   AND LOWER(BTRIM(sp.name)) = 'geotechnical engineering'
  WHERE p.institution_id = '0072cf6d-55a1-54e1-9a8c-767d8058f60a'::uuid
    AND (LOWER(p.name) = 'master of technology' OR LOWER(p.short_name) = 'm.tech')
  LIMIT 1
),
inserted AS (
  INSERT INTO public.curricula (
    id, institution_id, program_id, branch_id, scheme_id,
    grading_system_id, academic_year_id, specialization_id,
    version, status, total_semesters, total_credits, created_at, updated_at
  )
  SELECT
    md5('GECA-MTECH-GEOTECH-NEP-CURRICULUM-V1')::uuid,
    t.institution_id,
    t.program_id,
    t.branch_id,
    'bd65c899-2c56-5166-bcb9-8945030e1277'::uuid,
    '2925d20a-df5c-5e3f-b7b2-57f557bde6a4'::uuid,
    NULL,
    t.specialization_id,
    1,
    'DRAFT',
    4,
    NULL,
    NOW(),
    NOW()
  FROM target t
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.curricula existing
    WHERE existing.institution_id = t.institution_id
      AND existing.program_id = t.program_id
      AND existing.branch_id = t.branch_id
      AND existing.specialization_id = t.specialization_id
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id
),
curriculum AS (
  SELECT id FROM inserted
  UNION ALL
  SELECT c.id
  FROM public.curricula c
  JOIN target t
    ON c.institution_id = t.institution_id
   AND c.program_id = t.program_id
   AND c.branch_id = t.branch_id
   AND c.specialization_id = t.specialization_id
  WHERE NOT EXISTS (SELECT 1 FROM inserted)
  LIMIT 1
)
INSERT INTO public.semesters (
  id, curriculum_id, semester_number, active, created_at, updated_at
)
SELECT
  md5(c.id::text || ':semester:' || n)::uuid,
  c.id,
  n,
  TRUE,
  NOW(),
  NOW()
FROM curriculum c
CROSS JOIN generate_series(1, 4) AS n
ON CONFLICT (curriculum_id, semester_number) DO NOTHING;

COMMIT;
