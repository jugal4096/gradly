-- GECA M.Tech Production Engineering (Full-Time), NEP curriculum AY 2023-24.
-- Official curriculum: https://geca.ac.in/pdf/curriculum/PG/mech/NEPMTECHMECHWEF2324.pdf
-- This migration seeds the branch, specialization, DRAFT curriculum header, and four semesters.
-- Subject mappings are intentionally separate: each course's semester, credits, and elective
-- group must be transcribed from the official teaching-and-evaluation tables before import.
-- Committing this migration to GitHub does not execute it in Supabase.

BEGIN;

DO $$
DECLARE
  v_institution_id UUID := '0072cf6d-55a1-54e1-9a8c-767d8058f60a';
  v_program_id UUID := 'a4f77a0a-02e1-4c54-9f75-7b913f60a001';
  v_branch_id UUID;
  v_specialization_id UUID;
  v_curriculum_id UUID := md5('GECA-MTECH-PRODUCTION-NEP-2023-24-FT')::uuid;
  v_scheme_id UUID := 'bd65c899-2c56-5166-bcb9-8945030e1277';
  v_grading_system_id UUID := '2925d20a-df5c-5e3f-b7b2-57f557bde6a4';
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.programs p
    WHERE p.id = v_program_id
      AND p.institution_id = v_institution_id
      AND p.name = 'Master of Technology'
  ) THEN
    RAISE EXCEPTION 'Expected GECA Master of Technology program was not found.';
  END IF;

  -- Branches are linked to programs; this table has no institution_id column.
  SELECT b.id INTO v_branch_id
  FROM public.branches b
  WHERE b.program_id = v_program_id
    AND (
      lower(b.name) = 'mechanical engineering'
      OR lower(coalesce(b.code, '')) = 'mechanical'
    )
  ORDER BY CASE WHEN lower(b.name) = 'mechanical engineering' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_branch_id IS NULL THEN
    INSERT INTO public.branches
      (id, program_id, name, code, active, created_at, updated_at)
    SELECT
      md5('GECA-MTECH-MECHANICAL-BRANCH')::uuid,
      v_program_id,
      'Mechanical Engineering',
      'MECHANICAL',
      TRUE,
      NOW(),
      NOW()
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.branches b
      WHERE b.program_id = v_program_id
        AND (
          lower(b.name) = 'mechanical engineering'
          OR lower(coalesce(b.code, '')) = 'mechanical'
        )
    )
    ON CONFLICT DO NOTHING;

    SELECT b.id INTO v_branch_id
    FROM public.branches b
    WHERE b.program_id = v_program_id
      AND (
        lower(b.name) = 'mechanical engineering'
        OR lower(coalesce(b.code, '')) = 'mechanical'
      )
    LIMIT 1;
  END IF;

  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'Could not resolve GECA M.Tech Mechanical Engineering branch.';
  END IF;

  -- Specializations are linked to both program_id and branch_id.
  SELECT s.id INTO v_specialization_id
  FROM public.specializations s
  WHERE s.program_id = v_program_id
    AND s.branch_id = v_branch_id
    AND lower(s.name) = 'production engineering'
  LIMIT 1;

  IF v_specialization_id IS NULL THEN
    INSERT INTO public.specializations
      (id, program_id, branch_id, name, code, active, created_at, updated_at)
    SELECT
      md5('GECA-MTECH-PRODUCTION-SPECIALIZATION')::uuid,
      v_program_id,
      v_branch_id,
      'Production Engineering',
      'PRODUCTION',
      TRUE,
      NOW(),
      NOW()
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.specializations s
      WHERE s.program_id = v_program_id
        AND s.branch_id = v_branch_id
        AND lower(s.name) = 'production engineering'
    )
    ON CONFLICT DO NOTHING;

    SELECT s.id INTO v_specialization_id
    FROM public.specializations s
    WHERE s.program_id = v_program_id
      AND s.branch_id = v_branch_id
      AND lower(s.name) = 'production engineering'
    LIMIT 1;
  END IF;

  IF v_specialization_id IS NULL THEN
    RAISE EXCEPTION 'Could not resolve GECA M.Tech Production Engineering specialization.';
  END IF;

  -- Keep the curriculum DRAFT pending complete course-table review.
  IF NOT EXISTS (
    SELECT 1
    FROM public.curricula c
    WHERE c.institution_id = v_institution_id
      AND c.program_id = v_program_id
      AND c.specialization_id = v_specialization_id
      AND c.scheme_id = v_scheme_id
      AND c.total_semesters = 4
  ) THEN
    INSERT INTO public.curricula
      (id, institution_id, program_id, branch_id, scheme_id,
       academic_year_id, grading_system_id, version, status,
       total_semesters, total_credits, specialization_id, created_at, updated_at)
    VALUES
      (v_curriculum_id, v_institution_id, v_program_id, v_branch_id,
       v_scheme_id, NULL, v_grading_system_id, 1, 'DRAFT',
       4, 82, v_specialization_id, NOW(), NOW())
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT c.id INTO v_curriculum_id
  FROM public.curricula c
  WHERE c.institution_id = v_institution_id
    AND c.program_id = v_program_id
    AND c.specialization_id = v_specialization_id
    AND c.scheme_id = v_scheme_id
    AND c.total_semesters = 4
  ORDER BY c.created_at
  LIMIT 1;

  IF v_curriculum_id IS NULL THEN
    RAISE EXCEPTION 'Could not resolve the Production Engineering curriculum header.';
  END IF;

  -- Official semester credit totals: 22 + 26 + 18 + 16 = 82.
  INSERT INTO public.semesters
    (id, curriculum_id, semester_number, name, expected_credits, active, created_at, updated_at)
  SELECT
    md5(v_curriculum_id::text || ':semester:' || seed.semester_number)::uuid,
    v_curriculum_id,
    seed.semester_number,
    seed.semester_name,
    seed.expected_credits,
    TRUE,
    NOW(),
    NOW()
  FROM (VALUES
    (1, 'Semester I', 22::numeric),
    (2, 'Semester II', 26::numeric),
    (3, 'Semester III', 18::numeric),
    (4, 'Semester IV', 16::numeric)
  ) AS seed(semester_number, semester_name, expected_credits)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.semesters sem
    WHERE sem.curriculum_id = v_curriculum_id
      AND sem.semester_number = seed.semester_number
  )
  ON CONFLICT DO NOTHING;
END $$;

COMMIT;

-- Verification
SELECT
  c.id AS curriculum_id,
  p.name AS program_name,
  b.name AS branch_name,
  sp.name AS specialization_name,
  c.version,
  c.status,
  c.total_semesters,
  c.total_credits,
  sem.semester_number,
  sem.name AS semester_name,
  sem.expected_credits
FROM public.curricula c
JOIN public.programs p ON p.id = c.program_id
JOIN public.branches b ON b.id = c.branch_id
JOIN public.specializations sp ON sp.id = c.specialization_id
JOIN public.semesters sem ON sem.curriculum_id = c.id
WHERE c.institution_id = '0072cf6d-55a1-54e1-9a8c-767d8058f60a'::uuid
  AND lower(sp.name) = 'production engineering'
ORDER BY sem.semester_number;
