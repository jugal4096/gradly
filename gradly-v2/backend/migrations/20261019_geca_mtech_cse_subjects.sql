-- GECA M.Tech Computer Science & Engineering (Full-Time), NEP curriculum AY 2023-24.
-- Official source: https://geca.ac.in/pdf/curriculum/PG/cse/NEPMTECHCSECurriculumWEF2324.pdf
-- This migration seeds the CSE curriculum structure and its course catalogue.
-- Elective alternatives are represented as optional mappings sharing elective_group values;
-- they must not all be counted as simultaneously required credits.
-- The curriculum remains DRAFT until reviewed by an academic administrator.
-- Committing this migration to GitHub does not execute it in Supabase.

BEGIN;

DO $$
DECLARE
  v_institution_id UUID := '0072cf6d-55a1-54e1-9a8c-767d8058f60a';
  v_program_id UUID;
  v_branch_id UUID;
  v_curriculum_id UUID;
  v_semester_id UUID;
  v_subject_id UUID;
  v_scheme_id UUID := 'bd65c899-2c56-5166-bcb9-8945030e1277';
  v_grading_system_id UUID := '2925d20a-df5c-5e3f-b7b2-57f557bde6a4';
  r RECORD;
BEGIN
  SELECT p.id INTO v_program_id
  FROM public.programs p
  WHERE p.institution_id = v_institution_id
    AND lower(p.name) = 'master of technology'
  ORDER BY p.created_at NULLS LAST
  LIMIT 1;

  IF v_program_id IS NULL THEN
    RAISE EXCEPTION 'GECA Master of Technology programme was not found.';
  END IF;

  SELECT b.id INTO v_branch_id
  FROM public.branches b
  WHERE b.program_id = v_program_id
    AND (
      lower(b.name) LIKE '%computer science%'
      OR upper(coalesce(b.code, '')) = 'CSE'
    )
  ORDER BY
    CASE
      WHEN lower(b.name) LIKE '%computer science%'
       AND lower(b.name) LIKE '%engineering%' THEN 0
      ELSE 1
    END
  LIMIT 1;

  IF v_branch_id IS NULL THEN
    INSERT INTO public.branches
      (id, program_id, name, code, active, created_at, updated_at)
    VALUES
      (md5('GECA-MTECH-CSE-BRANCH')::uuid, v_program_id,
       'Computer Science and Engineering', 'CSE', TRUE, NOW(), NOW())
    ON CONFLICT DO NOTHING;

    SELECT b.id INTO v_branch_id
    FROM public.branches b
    WHERE b.program_id = v_program_id
      AND (
        lower(b.name) LIKE '%computer science%'
        OR upper(coalesce(b.code, '')) = 'CSE'
      )
    LIMIT 1;
  END IF;

  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'Could not resolve the GECA M.Tech CSE branch.';
  END IF;

  SELECT c.id INTO v_curriculum_id
  FROM public.curricula c
  WHERE c.institution_id = v_institution_id
    AND c.program_id = v_program_id
    AND c.branch_id = v_branch_id
    AND c.scheme_id = v_scheme_id
    AND c.total_semesters = 4
    AND c.specialization_id IS NULL
  ORDER BY c.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_curriculum_id IS NULL THEN
    INSERT INTO public.curricula
      (id, institution_id, program_id, branch_id, scheme_id,
       academic_year_id, grading_system_id, version, status,
       total_semesters, total_credits, specialization_id, created_at, updated_at)
    VALUES
      (md5('GECA-MTECH-CSE-NEP-2023-24-FT')::uuid,
       v_institution_id, v_program_id, v_branch_id, v_scheme_id,
       NULL, v_grading_system_id, 1, 'DRAFT', 4, 82, NULL, NOW(), NOW())
    ON CONFLICT DO NOTHING;

    SELECT c.id INTO v_curriculum_id
    FROM public.curricula c
    WHERE c.institution_id = v_institution_id
      AND c.program_id = v_program_id
      AND c.branch_id = v_branch_id
      AND c.scheme_id = v_scheme_id
      AND c.total_semesters = 4
      AND c.specialization_id IS NULL
    ORDER BY c.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_curriculum_id IS NULL THEN
    RAISE EXCEPTION 'Could not resolve/create the GECA M.Tech CSE curriculum.';
  END IF;

  INSERT INTO public.semesters
    (id, curriculum_id, semester_number, name, expected_credits, active, created_at, updated_at)
  SELECT
    md5(v_curriculum_id::text || ':semester:' || s.semester_number)::uuid,
    v_curriculum_id, s.semester_number, s.semester_name,
    s.expected_credits, TRUE, NOW(), NOW()
  FROM (VALUES
    (1, 'Semester I', 22::numeric),
    (2, 'Semester II', 26::numeric),
    (3, 'Semester III', 18::numeric),
    (4, 'Semester IV', 16::numeric)
  ) AS s(semester_number, semester_name, expected_credits)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.semesters sem
    WHERE sem.curriculum_id = v_curriculum_id
      AND sem.semester_number = s.semester_number
  )
  ON CONFLICT DO NOTHING;

  UPDATE public.semesters sem
  SET name = s.semester_name,
      expected_credits = s.expected_credits,
      updated_at = NOW()
  FROM (VALUES
    (1, 'Semester I', 22::numeric),
    (2, 'Semester II', 26::numeric),
    (3, 'Semester III', 18::numeric),
    (4, 'Semester IV', 16::numeric)
  ) AS s(semester_number, semester_name, expected_credits)
  WHERE sem.curriculum_id = v_curriculum_id
    AND sem.semester_number = s.semester_number;

  -- The official semester teaching/evaluation tables and elective catalogues
  -- are transcribed below. Elective alternatives are grouped, not compulsory.

  FOR r IN
    SELECT *
    FROM (VALUES
      -- Semester I: core, programme electives, mini-project, research and audit.
      (1, 'CSPCC5001', 'Advanced Data Structures', 4::numeric, 'THEORY', TRUE, NULL::text),
      (1, 'CSPCC5002', 'Advanced Machine Learning', 3::numeric, 'THEORY', TRUE, NULL::text),
      (1, 'CSPCC5003', 'Lab - Advanced Machine Learning', 1::numeric, 'PRACTICAL', TRUE, NULL::text),
      (1, 'CSPEC5001', 'Advanced Cloud Computing', 4::numeric, 'ELECTIVE', FALSE, 'S1_PE_I'),
      (1, 'CSPEC5002', 'Advanced Computer Network', 4::numeric, 'ELECTIVE', FALSE, 'S1_PE_I'),
      (1, 'CSPEC5003', 'Soft Computing', 4::numeric, 'ELECTIVE', FALSE, 'S1_PE_I'),
      (1, 'CSPEC5004', 'Intelligent Systems', 4::numeric, 'ELECTIVE', FALSE, 'S1_PE_II'),
      (1, 'CSPEC5005', 'Distributed Computing Systems', 4::numeric, 'ELECTIVE', FALSE, 'S1_PE_II'),
      (1, 'CSPEC5006', 'Internet of Things with Raspberry Pi', 4::numeric, 'ELECTIVE', FALSE, 'S1_PE_II'),
      (1, 'CSVSE5001', 'Mini Project - I', 2::numeric, 'PROJECT', TRUE, NULL::text),
      (1, 'MERMC5001', 'Research Methodology', 4::numeric, 'THEORY', TRUE, NULL::text),
      (1, 'INCCC5001', 'Yoga/Club', 0::numeric, 'AUDIT', TRUE, NULL::text),

      -- Semester II: core and Programme Electives III and IV.
      (2, 'CSPCC5004', 'Advanced Data Mining', 4::numeric, 'THEORY', TRUE, NULL::text),
      (2, 'CSPCC5005', 'Recommender Systems', 4::numeric, 'THEORY', TRUE, NULL::text),
      (2, 'CSPCC5006', 'Computer Vision', 3::numeric, 'THEORY', TRUE, NULL::text),
      (2, 'CSPCC5007', 'Lab - Computer Vision', 1::numeric, 'PRACTICAL', TRUE, NULL::text),
      (2, 'CSPEC5007', 'Speech and Natural Language Processing', 3::numeric, 'ELECTIVE', FALSE, 'S2_PE_III'),
      (2, 'CSPEC5008', 'Cryptography and Information Security', 3::numeric, 'ELECTIVE', FALSE, 'S2_PE_III'),
      (2, 'CSPEC5009', 'Biometrics', 3::numeric, 'ELECTIVE', FALSE, 'S2_PE_III'),
      (2, 'CSPEC5010', 'Big Data Analytics', 3::numeric, 'ELECTIVE', FALSE, 'S2_PE_IV'),
      (2, 'CSPEC5011', 'High Performance Computing', 3::numeric, 'ELECTIVE', FALSE, 'S2_PE_IV'),
      (2, 'CSPEC5012', 'Wireless Sensor Network', 3::numeric, 'ELECTIVE', FALSE, 'S2_PE_IV'),

      -- Semester II Open Elective I: external options; CSOEC5002 is explicitly
      -- not for CSE PG students in the GECA curriculum and is not seeded here.
      (2, 'AMOEC5001', 'Basics of Finite Element Analysis', 3::numeric, 'ELECTIVE', FALSE, 'S2_OPEN_ELECTIVE_I'),
      (2, 'CEOEC5003', 'Engineering Optimization', 3::numeric, 'ELECTIVE', FALSE, 'S2_OPEN_ELECTIVE_I'),
      (2, 'MEOEC5004', 'Robotics', 3::numeric, 'ELECTIVE', FALSE, 'S2_OPEN_ELECTIVE_I'),
      (2, 'EEOEC5005', 'Electric Vehicles', 3::numeric, 'ELECTIVE', FALSE, 'S2_OPEN_ELECTIVE_I'),
      (2, 'ECOEC5006', 'IoT for Smart Systems', 3::numeric, 'ELECTIVE', FALSE, 'S2_OPEN_ELECTIVE_I'),
      (2, 'CSVSE5002', 'Mini Project - II', 2::numeric, 'PROJECT', TRUE, NULL::text),
      (2, 'EEAEC5001', 'Technical Communication', 3::numeric, 'THEORY', TRUE, NULL::text),

      -- Semester III Open Elective II: external options; CSOEC6002 is explicitly
      -- not for CSE PG students in the GECA curriculum and is not seeded here.
      (3, 'AMOEC6001', 'Indian Constitution', 3::numeric, 'ELECTIVE', FALSE, 'S3_OPEN_ELECTIVE_II'),
      (3, 'CEOEC6003', 'Disaster Management', 3::numeric, 'ELECTIVE', FALSE, 'S3_OPEN_ELECTIVE_II'),
      (3, 'MEOEC6004', 'Additive Product Management', 3::numeric, 'ELECTIVE', FALSE, 'S3_OPEN_ELECTIVE_II'),
      (3, 'EEOEC6005', 'Smart Grid Systems', 3::numeric, 'ELECTIVE', FALSE, 'S3_OPEN_ELECTIVE_II'),
      (3, 'ECOEC6006', 'Soft Computing', 3::numeric, 'ELECTIVE', FALSE, 'S3_OPEN_ELECTIVE_II'),

      -- Semester III Humanities / Economics / Management alternatives.
      (3, 'MEEEM6001', 'Entrepreneurship Development', 3::numeric, 'ELECTIVE', FALSE, 'S3_HSSM'),
      (3, 'ECEEM6002', 'Engineering Economics', 3::numeric, 'ELECTIVE', FALSE, 'S3_HSSM'),
      (3, 'MEEEM6003', 'Industrial Management', 3::numeric, 'ELECTIVE', FALSE, 'S3_HSSM'),
      (3, 'ECIKS6001', 'Vedic Approach to Mathematics', 2::numeric, 'THEORY', TRUE, NULL::text),
      (3, 'CSDIS6001', 'Dissertation - I', 10::numeric, 'PROJECT', TRUE, NULL::text),

      -- Semester IV.
      (4, 'CSDIS6002', 'Dissertation - II/OJT', 16::numeric, 'PROJECT', TRUE, NULL::text)
    ) AS x(
      semester_number, course_code, course_name, credits,
      course_type, mandatory, elective_group
    )
  LOOP
    SELECT sem.id INTO v_semester_id
    FROM public.semesters sem
    WHERE sem.curriculum_id = v_curriculum_id
      AND sem.semester_number = r.semester_number;

    IF v_semester_id IS NULL THEN
      RAISE EXCEPTION 'Semester % is missing from the CSE curriculum.', r.semester_number;
    END IF;

    SELECT s.id INTO v_subject_id
    FROM public.subjects s
    WHERE s.institution_id = v_institution_id
      AND s.canonical_code = r.course_code
    LIMIT 1;

    IF v_subject_id IS NULL THEN
      INSERT INTO public.subjects
        (institution_id, canonical_code, canonical_name, active)
      VALUES
        (v_institution_id, r.course_code, r.course_name, TRUE)
      ON CONFLICT DO NOTHING;

      SELECT s.id INTO v_subject_id
      FROM public.subjects s
      WHERE s.institution_id = v_institution_id
        AND s.canonical_code = r.course_code
      LIMIT 1;

      IF v_subject_id IS NULL THEN
        SELECT s.id INTO v_subject_id
        FROM public.subjects s
        WHERE s.canonical_code = r.course_code
        LIMIT 1;
      END IF;
    END IF;

    IF v_subject_id IS NULL THEN
      RAISE EXCEPTION 'Could not resolve subject master record for %.', r.course_code;
    END IF;

    -- Keep the canonical title aligned with the official course catalogue.
    UPDATE public.subjects
    SET canonical_name = r.course_name,
        updated_at = NOW()
    WHERE id = v_subject_id
      AND canonical_name IS DISTINCT FROM r.course_name;

    -- Correct any earlier provisional mapping and make this migration repeatable.
    IF EXISTS (
      SELECT 1 FROM public.curriculum_subjects cs
      WHERE cs.curriculum_id = v_curriculum_id
        AND cs.course_code = r.course_code
    ) THEN
      UPDATE public.curriculum_subjects
      SET semester_id = v_semester_id,
          subject_id = v_subject_id,
          course_name = r.course_name,
          credits = r.credits,
          course_type = r.course_type,
          mandatory = r.mandatory,
          elective_group = r.elective_group,
          active = TRUE,
          course_id = r.course_code,
          updated_at = NOW()
      WHERE curriculum_id = v_curriculum_id
        AND course_code = r.course_code;
    ELSE
      INSERT INTO public.curriculum_subjects (
        curriculum_id, semester_id, subject_id, course_code,
        course_name, credits, course_type, mandatory,
        elective_group, active, course_id
      )
      VALUES (
        v_curriculum_id, v_semester_id, v_subject_id, r.course_code,
        r.course_name, r.credits, r.course_type, r.mandatory,
        r.elective_group, TRUE, r.course_code
      );
    END IF;
  END LOOP;

  -- The official CSE course list uses these two codes only as exclusions
  -- ("not for CSE PG students"), so don't leave them mapped to this curriculum.
  DELETE FROM public.curriculum_subjects
  WHERE curriculum_id = v_curriculum_id
    AND course_code IN ('CSOEC5002', 'CSOEC6002');

  RAISE NOTICE 'GECA M.Tech CSE curriculum seeded/updated. Curriculum ID: %', v_curriculum_id;
END $$;

COMMIT;

-- Verification: course rows and semester credit summaries.
SELECT
  c.id AS curriculum_id,
  c.status,
  p.name AS program,
  b.name AS branch,
  sem.semester_number,
  sem.name AS semester,
  sem.expected_credits,
  COUNT(cs.id) AS mapped_course_rows,
  COALESCE(SUM(cs.credits) FILTER (WHERE cs.mandatory), 0) AS mandatory_credit_sum,
  COUNT(cs.id) FILTER (WHERE cs.elective_group IS NOT NULL) AS elective_options
FROM public.curricula c
JOIN public.programs p ON p.id = c.program_id
JOIN public.branches b ON b.id = c.branch_id
JOIN public.semesters sem ON sem.curriculum_id = c.id
LEFT JOIN public.curriculum_subjects cs
  ON cs.curriculum_id = c.id AND cs.semester_id = sem.id
WHERE c.institution_id = '0072cf6d-55a1-54e1-9a8c-767d8058f60a'::uuid
  AND p.id = (
    SELECT id FROM public.programs
    WHERE institution_id = '0072cf6d-55a1-54e1-9a8c-767d8058f60a'::uuid
      AND lower(name) = 'master of technology'
    ORDER BY created_at NULLS LAST
    LIMIT 1
  )
  AND (
    lower(b.name) LIKE '%computer science%'
    OR upper(coalesce(b.code, '')) = 'CSE'
  )
  AND c.specialization_id IS NULL
GROUP BY c.id, c.status, p.name, b.name,
         sem.semester_number, sem.name, sem.expected_credits
ORDER BY sem.semester_number;
