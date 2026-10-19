-- GECA M.Tech Electrical Machine Drives (EMD), NEP curriculum effective AY 2023-24.
-- Official source: https://geca.ac.in/pdf/curriculum/PG/elect/NEPEMDCurriculum2324.pdf
-- Course structure follows the GECA curriculum PDF. Elective catalogue entries are optional,
-- not all simultaneously required. Curriculum remains DRAFT pending academic-year mapping/review.
-- Apply in Supabase SQL Editor; committing this migration to GitHub does not execute it.

BEGIN;

-- Ensure the M.Tech Electrical branch exists (shared with Electrical Power Systems).
INSERT INTO public.branches (id, program_id, name, code, active, created_at, updated_at)
SELECT 'c6f77a0a-02e1-4c54-9f75-7b913f60a003'::uuid, p.id,
       'ELECTRICAL', 'ELECTRICAL', TRUE, NOW(), NOW()
FROM public.programs p
WHERE p.institution_id = '0072cf6d-55a1-54e1-9a8c-767d8058f60a'::uuid
  AND (p.name = 'Master of Technology' OR p.short_name = 'M.Tech')
ON CONFLICT (program_id, name) DO NOTHING;

-- Register Electrical Machines and Drives specialization.
INSERT INTO public.specializations (program_id, branch_id, name, code, active, created_at, updated_at)
SELECT p.id, b.id, 'Electrical Machines and Drives', 'EMD', TRUE, NOW(), NOW()
FROM public.programs p
JOIN public.branches b ON b.program_id = p.id AND upper(b.name) = 'ELECTRICAL'
WHERE p.institution_id = '0072cf6d-55a1-54e1-9a8c-767d8058f60a'::uuid
  AND (p.name = 'Master of Technology' OR p.short_name = 'M.Tech')
ON CONFLICT (program_id, branch_id, code) DO NOTHING;

-- Create curriculum header. Keep DRAFT until the academic year and credits are reviewed.
INSERT INTO public.curricula (
  id, institution_id, program_id, branch_id, scheme_id, grading_system_id,
  academic_year_id, specialization_id, version, status, total_semesters,
  total_credits, created_at, updated_at
)
SELECT
  'd7f77a0a-02e1-4c54-9f75-7b913f60a101'::uuid,
  p.institution_id, p.id, b.id,
  'bd65c899-2c56-5166-bcb9-8945030e1277'::uuid,
  '2925d20a-df5c-5e3f-b7b2-57f557bde6a4'::uuid,
  NULL, sp.id, 1, 'DRAFT', 4, 82, NOW(), NOW()
FROM public.programs p
JOIN public.branches b ON b.program_id = p.id AND upper(b.name) = 'ELECTRICAL'
JOIN public.specializations sp ON sp.program_id = p.id AND sp.branch_id = b.id AND sp.code = 'EMD'
WHERE p.institution_id = '0072cf6d-55a1-54e1-9a8c-767d8058f60a'::uuid
  AND (p.name = 'Master of Technology' OR p.short_name = 'M.Tech')
  AND NOT EXISTS (SELECT 1 FROM public.curricula c WHERE c.specialization_id = sp.id);

INSERT INTO public.semesters (id, curriculum_id, semester_number, active, created_at, updated_at)
SELECT md5(c.id::text || ':semester:' || n)::uuid, c.id, n, TRUE, NOW(), NOW()
FROM public.curricula c
JOIN public.specializations sp ON sp.id = c.specialization_id AND sp.code = 'EMD'
CROSS JOIN generate_series(1,4) AS n
ON CONFLICT (curriculum_id, semester_number) DO NOTHING;

CREATE TEMP TABLE _geca_emd_course_seed (
  semester_number integer NOT NULL,
  course_code text NOT NULL,
  course_name text NOT NULL,
  credits numeric NOT NULL,
  course_type text NOT NULL,
  mandatory boolean NOT NULL,
  elective_group text
) ON COMMIT DROP;

INSERT INTO _geca_emd_course_seed VALUES
-- SEMESTER I (GECA PDF, course structure)
(1,'EEPCC5002','Advanced Power Electronics',3,'THEORY',TRUE,NULL),
(1,'EEPCC5003','Electrical Machine Modeling and Analysis',3,'THEORY',TRUE,NULL),
(1,'EEPCC6001','Electric Vehicles',3,'THEORY',TRUE,NULL),
(1,'EEPCC6002','Lab Simulation-I',1,'PRACTICAL',TRUE,NULL),
(1,'EEVSE6001','Lab-Hardware',2,'PRACTICAL',TRUE,NULL),
(1,'MERMC5001','Research Methodology',4,'THEORY',TRUE,NULL),
-- Program Electives I/II; alternative elective catalogue
(1,'EEPEC6001','Industrial Automation & Control',3,'ELECTIVE',FALSE,'EMD-SEM1-PE'),
(1,'EEPEC6002','PWM Techniques for Power Converters',3,'ELECTIVE',FALSE,'EMD-SEM1-PE'),
(1,'EEPEC6003','Embedded Systems',3,'ELECTIVE',FALSE,'EMD-SEM1-PE'),
(1,'EEPEC6004','Electromagnetic Interference Techniques',3,'ELECTIVE',FALSE,'EMD-SEM1-PE'),
(1,'EEPEC5003','Power System Reliability',3,'ELECTIVE',FALSE,'EMD-SEM1-PE'),
(1,'EEPEC5004','Smart Grid Technology',3,'ELECTIVE',FALSE,'EMD-SEM1-PE'),
(1,'EEPEC5005','Data Science Applications in Electrical Engineering',3,'ELECTIVE',FALSE,'EMD-SEM1-PE'),

-- SEMESTER II (the official PDF's second-semester structure)
(2,'EEPCC6011','Advanced Control Systems',3,'THEORY',TRUE,NULL),
(2,'EEPCC6012','Advanced Electric Drives',3,'THEORY',TRUE,NULL),
(2,'EEPCC6013','Lab Simulation-II',2,'PRACTICAL',TRUE,NULL),
(2,'EEPCC6014','Lab Advanced Electric Drives',1,'PRACTICAL',TRUE,NULL),
(2,'EEAEC5001','Technical Communication',3,'THEORY',TRUE,NULL),
(2,'EEVEC6002','Mini Project',2,'PROJECT',TRUE,NULL),
-- Program Electives III, IV and V
(2,'EEPEC6010','Reliability and Condition Monitoring',3,'ELECTIVE',FALSE,'EMD-SEM2-PE'),
(2,'EEPEC6011','Electrical Drives Applications',3,'ELECTIVE',FALSE,'EMD-SEM2-PE'),
(2,'EEPEC6012','Digital Control Systems',3,'ELECTIVE',FALSE,'EMD-SEM2-PE'),
(2,'EEPEC6013','Energy Storage Systems',3,'ELECTIVE',FALSE,'EMD-SEM2-PE'),
(2,'EEPEC6014','Machine Learning & Applications',3,'ELECTIVE',FALSE,'EMD-SEM2-PE'),
(2,'EEPEC6015','Optimal Control Systems',3,'ELECTIVE',FALSE,'EMD-SEM2-PE'),
(2,'EEPEC5013','Integration of Renewable Energy Sources',3,'ELECTIVE',FALSE,'EMD-SEM2-PE'),
(2,'EEPEC5014','Life Estimation of Power Equipments',3,'ELECTIVE',FALSE,'EMD-SEM2-PE'),
(2,'EEPEC5015','Optimization Techniques',3,'ELECTIVE',FALSE,'EMD-SEM2-PE'),
(2,'EEPEC5016','Smart Appliances & IoT',3,'ELECTIVE',FALSE,'EMD-SEM2-PE'),
(2,'EEPEC5017','Power Quality and Mitigation',3,'ELECTIVE',FALSE,'EMD-SEM2-PE'),
-- Open Elective I catalogue (EEOEC5001 is explicitly not for Electrical PG students in this PDF)
(2,'AMOEC5001','Basics of Finite Element Analysis',3,'ELECTIVE',FALSE,'EMD-SEM2-OE1'),
(2,'CSOEC5002','Professional Ethics & Cyber Law',3,'ELECTIVE',FALSE,'EMD-SEM2-OE1'),
(2,'CEOEC5003','Engineering Optimization',3,'ELECTIVE',FALSE,'EMD-SEM2-OE1'),
(2,'MEOEC5004','Robotics',3,'ELECTIVE',FALSE,'EMD-SEM2-OE1'),
(2,'ECOEC5006','IoT for Smart Systems',3,'ELECTIVE',FALSE,'EMD-SEM2-OE1'),

-- SEMESTER III
(3,'EEDIS6020','Dissertation Phase I',10,'PROJECT',TRUE,NULL),
(3,'INIKS6001','Vedic Approach to Mathematics',2,'THEORY',TRUE,NULL),
(3,'EEOEC5002','Energy Audit and Management',3,'ELECTIVE',FALSE,'EMD-SEM3-OE2'),
(3,'MEEEM6001','Entrepreneurship Development',3,'ELECTIVE',FALSE,'EMD-SEM3-HSS'),
(3,'EEEEM6002','Engineering Economics',3,'ELECTIVE',FALSE,'EMD-SEM3-HSS'),
(3,'MEEEM6003','Industrial Management',3,'ELECTIVE',FALSE,'EMD-SEM3-HSS'),
(3,'AMOEC6001','Indian Constitution',3,'ELECTIVE',FALSE,'EMD-SEM3-OE2'),
(3,'CSOEC6002','Data Science',3,'ELECTIVE',FALSE,'EMD-SEM3-OE2'),
(3,'CEOEC6003','Disaster Management',3,'ELECTIVE',FALSE,'EMD-SEM3-OE2'),
(3,'MEOEC6004','Additive Manufacturing',3,'ELECTIVE',FALSE,'EMD-SEM3-OE2'),
(3,'ECOEC6006','Soft Computing',3,'ELECTIVE',FALSE,'EMD-SEM3-OE2'),

-- SEMESTER IV
(4,'EEDIS6021','Dissertation Phase II',16,'PROJECT',TRUE,NULL);

-- Create canonical subject rows without overwriting existing subjects.
INSERT INTO public.subjects
  (id, institution_id, canonical_code, canonical_name, active, created_at, updated_at)
SELECT DISTINCT
  md5('GECA-SUBJECT:' || course_code)::uuid,
  '0072cf6d-55a1-54e1-9a8c-767d8058f60a'::uuid,
  course_code, course_name, TRUE, NOW(), NOW()
FROM _geca_emd_course_seed
ON CONFLICT (id) DO NOTHING;

-- Insert rows idempotently. Course IDs are namespaced to the EMD specialization.
INSERT INTO public.curriculum_subjects (
  id, curriculum_id, semester_id, subject_id, course_code, course_name, credits,
  course_type, mandatory, active, course_id, elective_group, created_at, updated_at
)
SELECT
  md5(c.id::text || ':' || seed.semester_number::text || ':' || seed.course_code)::uuid,
  c.id, sem.id, md5('GECA-SUBJECT:' || seed.course_code)::uuid,
  seed.course_code, seed.course_name, seed.credits, seed.course_type, seed.mandatory,
  TRUE, 'GECA-EMD-' || seed.course_code, seed.elective_group, NOW(), NOW()
FROM _geca_emd_course_seed seed
JOIN public.curricula c ON c.specialization_id IN (
  SELECT id FROM public.specializations WHERE code = 'EMD'
)
JOIN public.semesters sem
  ON sem.curriculum_id = c.id AND sem.semester_number = seed.semester_number
ON CONFLICT (curriculum_id, semester_id, course_code) DO NOTHING;

-- Verify seeded rows semester-wise.
SELECT sp.name AS specialization, sem.semester_number,
       COUNT(cs.id) AS course_rows,
       COUNT(cs.id) FILTER (WHERE cs.mandatory) AS mandatory_rows,
       COUNT(cs.id) FILTER (WHERE NOT cs.mandatory) AS optional_rows
FROM public.curricula c
JOIN public.specializations sp ON sp.id = c.specialization_id
JOIN public.semesters sem ON sem.curriculum_id = c.id
LEFT JOIN public.curriculum_subjects cs
  ON cs.curriculum_id = c.id AND cs.semester_id = sem.id
WHERE sp.code = 'EMD'
GROUP BY sp.name, sem.semester_number
ORDER BY sem.semester_number;

COMMIT;
