-- GECA M.Tech Electrical Power Systems (NEP, effective AY 2023-24)
-- Source: https://geca.ac.in/pdf/curriculum/PG/elect/NEPEPSCurriculum2324.pdf
-- Seeds the course catalogue, preserving elective groups as optional choices.
-- Curriculum remains DRAFT; academic_year_id is NULL pending verified academic-year mapping.
-- Apply in Supabase SQL Editor. GitHub commits do NOT execute SQL on the live database.

BEGIN;

-- 1. Ensure M.Tech programme exists.
INSERT INTO public.programs
  (id, institution_id, name, short_name, level, duration_semesters, active, created_at, updated_at)
SELECT
  'a4f77a0a-02e1-4c54-9f75-7b913f60a001'::uuid,
  '0072cf6d-55a1-54e1-9a8c-767d8058f60a'::uuid,
  'Master of Technology', 'M.Tech', 'POSTGRADUATE', 4, TRUE, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.programs
  WHERE institution_id = '0072cf6d-55a1-54e1-9a8c-767d8058f60a'::uuid
    AND (name = 'Master of Technology' OR short_name = 'M.Tech')
)
ON CONFLICT DO NOTHING;

-- 2. Add Electrical department/branch to M.Tech.
INSERT INTO public.branches (id, program_id, name, code, active, created_at, updated_at)
SELECT
  'c6f77a0a-02e1-4c54-9f75-7b913f60a003'::uuid,
  p.id, 'ELECTRICAL', 'ELECTRICAL', TRUE, NOW(), NOW()
FROM public.programs p
WHERE p.institution_id = '0072cf6d-55a1-54e1-9a8c-767d8058f60a'::uuid
  AND (p.name = 'Master of Technology' OR p.short_name = 'M.Tech')
ON CONFLICT (program_id, name) DO NOTHING;

-- 3. Ensure specialization exists (migration 20261019_geca_mtech_program_specializations.sql
-- should already have created public.specializations).
INSERT INTO public.specializations (program_id, branch_id, name, code, active, created_at, updated_at)
SELECT p.id, b.id, 'Electrical Power Systems', 'EPS', TRUE, NOW(), NOW()
FROM public.programs p
JOIN public.branches b ON b.program_id = p.id AND upper(b.name) = 'ELECTRICAL'
WHERE p.institution_id = '0072cf6d-55a1-54e1-9a8c-767d8058f60a'::uuid
  AND (p.name = 'Master of Technology' OR p.short_name = 'M.Tech')
ON CONFLICT (program_id, branch_id, code) DO NOTHING;

-- 4. Create a draft curriculum header, only if one is not already linked to EPS.
INSERT INTO public.curricula (
  id, institution_id, program_id, branch_id, scheme_id, grading_system_id,
  academic_year_id, specialization_id, version, status, total_semesters,
  total_credits, created_at, updated_at
)
SELECT
  'c6f77a0a-02e1-4c54-9f75-7b913f60a101'::uuid,
  p.institution_id, p.id, b.id,
  'bd65c899-2c56-5166-bcb9-8945030e1277'::uuid,
  '2925d20a-df5c-5e3f-b7b2-57f557bde6a4'::uuid,
  NULL, sp.id, 1, 'DRAFT', 4, 82, NOW(), NOW()
FROM public.programs p
JOIN public.branches b ON b.program_id = p.id AND upper(b.name) = 'ELECTRICAL'
JOIN public.specializations sp ON sp.program_id = p.id AND sp.branch_id = b.id AND sp.code = 'EPS'
WHERE p.institution_id = '0072cf6d-55a1-54e1-9a8c-767d8058f60a'::uuid
  AND (p.name = 'Master of Technology' OR p.short_name = 'M.Tech')
  AND NOT EXISTS (SELECT 1 FROM public.curricula c WHERE c.specialization_id = sp.id);

-- 5. Four semesters.
INSERT INTO public.semesters (id, curriculum_id, semester_number, active, created_at, updated_at)
SELECT md5(c.id::text || ':semester:' || n)::uuid, c.id, n, TRUE, NOW(), NOW()
FROM public.curricula c
CROSS JOIN generate_series(1, 4) AS n
JOIN public.specializations sp ON sp.id = c.specialization_id AND sp.code = 'EPS'
ON CONFLICT (curriculum_id, semester_number) DO NOTHING;

-- 6. Official course rows. Elective choices are stored as optional catalogue rows,
-- not as courses all students must take. Course names/codes are from the GECA PDF.
CREATE TEMP TABLE _geca_eps_course_seed (
  semester_number integer NOT NULL,
  course_code text NOT NULL,
  course_name text NOT NULL,
  credits numeric NOT NULL,
  course_type text NOT NULL,
  mandatory boolean NOT NULL,
  elective_group text
) ON COMMIT DROP;

INSERT INTO _geca_eps_course_seed VALUES
-- SEMESTER I: core, lab, research and audit activity
(1,'EEPCC5001','Digital Protection of Power Systems',3,'THEORY',TRUE,NULL),
(1,'EEPCC5002','Advanced Power Electronics',3,'THEORY',TRUE,NULL),
(1,'EEPCC5003','Electrical Machine Modeling and Analysis',3,'THEORY',TRUE,NULL),
(1,'EEPCC5004','Lab Simulation-I',2,'PRACTICAL',TRUE,NULL),
(1,'EEVSE5001','Lab- Power Engineering',1,'PRACTICAL',TRUE,NULL),
(1,'MERMC5001','Research Methodology',4,'THEORY',TRUE,NULL),
(1,'INCCC5001','Yoga/Club Activities',0,'AUDIT',FALSE,NULL),
-- SEMESTER I: Program Elective-I catalogue (select one)
(1,'EEPEC5001','Power System Planning Operation & Control',3,'ELECTIVE',FALSE,'EPS-SEM1-PE1'),
(1,'EEPEC5002','Extra High Voltage AC Transmission',3,'ELECTIVE',FALSE,'EPS-SEM1-PE1'),
(1,'EEPEC5003','Power System Reliability',3,'ELECTIVE',FALSE,'EPS-SEM1-PE1'),
(1,'EEPEC5004','Smart Grid Technology',3,'ELECTIVE',FALSE,'EPS-SEM1-PE1'),
(1,'EEPEC5005','Data Science Applications in Electrical Engineering',3,'ELECTIVE',FALSE,'EPS-SEM1-PE1'),
(1,'EEPEC5006','Computer Aided Power System Analysis',3,'ELECTIVE',FALSE,'EPS-SEM1-PE1'),
-- SEMESTER I: Program Elective-II catalogue (select one)
(1,'EEPCC6001','Electric Vehicles',3,'ELECTIVE',FALSE,'EPS-SEM1-PE2'),
(1,'EEPEC6002','PWM Techniques for Power Converters',3,'ELECTIVE',FALSE,'EPS-SEM1-PE2'),
(1,'EEPEC6003','Embedded Systems',3,'ELECTIVE',FALSE,'EPS-SEM1-PE2'),
(1,'EEPEC6004','Electromagnetic Interference Techniques',3,'ELECTIVE',FALSE,'EPS-SEM1-PE2'),

-- SEMESTER II: core and practicals
(2,'EEPCC5010','Power Systems Dynamics and Stability',3,'THEORY',TRUE,NULL),
(2,'EEPCC5011','HVDC & FACTs',3,'THEORY',TRUE,NULL),
(2,'EEPCC5012','Lab Simulation-II',2,'PRACTICAL',TRUE,NULL),
(2,'EEPCC5013','Lab Renewable Energy Technology',1,'PRACTICAL',TRUE,NULL),
(2,'EEAEC5001','Technical Communication',3,'THEORY',TRUE,NULL),
(2,'EEVEC5002','Mini Project',2,'PROJECT',TRUE,NULL),
-- SEMESTER II: Program Elective-III catalogue
(2,'EEPEC5011','Electrical Power Distribution Systems',3,'ELECTIVE',FALSE,'EPS-SEM2-PE3'),
(2,'EEPEC5012','Restructured Power Systems',3,'ELECTIVE',FALSE,'EPS-SEM2-PE3'),
(2,'EEPEC5013','Integration of Renewable Energy Sources',3,'ELECTIVE',FALSE,'EPS-SEM2-PE3'),
(2,'EEPEC5014','Life Estimation of Power Equipments',3,'ELECTIVE',FALSE,'EPS-SEM2-PE3'),
(2,'EEPEC5015','Optimization Techniques',3,'ELECTIVE',FALSE,'EPS-SEM2-PE3'),
(2,'EEPEC5016','Smart Appliances & IoT',3,'ELECTIVE',FALSE,'EPS-SEM2-PE3'),
(2,'EEPEC5017','Power Quality and Mitigation',3,'ELECTIVE',FALSE,'EPS-SEM2-PE3'),
-- SEMESTER II: Program Elective-IV/V catalogue
(2,'EEPCC6011','Advanced Control Systems',3,'ELECTIVE',FALSE,'EPS-SEM2-PE4-5'),
(2,'EEPCC6012','Advanced Electrical Drives',3,'ELECTIVE',FALSE,'EPS-SEM2-PE4-5'),
(2,'EEPEC6013','Energy Storage Systems',3,'ELECTIVE',FALSE,'EPS-SEM2-PE4-5'),
(2,'EEPEC6014','Machine Learning & Applications',3,'ELECTIVE',FALSE,'EPS-SEM2-PE4-5'),
-- SEMESTER II: open elective catalogue. The PDF notes equivalent MOOCs may be approved.
(2,'AMOEC5001','Basics of Finite Element Analysis',3,'ELECTIVE',FALSE,'EPS-SEM2-OE1'),
(2,'CSOEC5002','Professional Ethics & Cyber Law',3,'ELECTIVE',FALSE,'EPS-SEM2-OE1'),
(2,'CEOEC5003','Engineering Optimization',3,'ELECTIVE',FALSE,'EPS-SEM2-OE1'),
(2,'MEOEC5004','Robotics',3,'ELECTIVE',FALSE,'EPS-SEM2-OE1'),
(2,'ECOEC5006','IoT for Smart Systems',3,'ELECTIVE',FALSE,'EPS-SEM2-OE1'),
-- SEMESTER III: dissertation, institute electives and knowledge systems
(3,'EEDIS5020','Dissertation Ph I',10,'PROJECT',TRUE,NULL),
(3,'EEOEC5002','Energy Audit and Management',3,'ELECTIVE',FALSE,'EPS-SEM3-OE2'),
(3,'INIKS6001','Vedic Approach to Mathematics',2,'THEORY',TRUE,NULL),
(3,'MEEEM6001','Entrepreneurship Development',3,'ELECTIVE',FALSE,'EPS-SEM3-HSS'),
(3,'EEEEM6002','Engineering Economics',3,'ELECTIVE',FALSE,'EPS-SEM3-HSS'),
(3,'MEEEM6003','Industrial Management',3,'ELECTIVE',FALSE,'EPS-SEM3-HSS'),
(3,'AMOEC6001','Indian Constitution',3,'ELECTIVE',FALSE,'EPS-SEM3-OE2'),
(3,'CSOEC6002','Data Science',3,'ELECTIVE',FALSE,'EPS-SEM3-OE2'),
(3,'CEOEC6003','Disaster Management',3,'ELECTIVE',FALSE,'EPS-SEM3-OE2'),
(3,'MEOEC6004','Additive Manufacturing',3,'ELECTIVE',FALSE,'EPS-SEM3-OE2'),
(3,'ECOEC6006','Soft Computing',3,'ELECTIVE',FALSE,'EPS-SEM3-OE2'),
-- SEMESTER IV
(4,'EEDIS5021','Dissertation Ph II',16,'PROJECT',TRUE,NULL);

-- Canonical subject catalogue.
-- Avoid primary-key collisions and reuse existing subject rows by canonical_code.
-- This is safe when the database already contains some or all of these subjects.
INSERT INTO public.subjects
  (id, institution_id, canonical_code, canonical_name, active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  '0072cf6d-55a1-54e1-9a8c-767d8058f60a'::uuid,
  seed.course_code, seed.course_name, TRUE, NOW(), NOW()
FROM (
  SELECT DISTINCT course_code, course_name
  FROM _geca_eps_course_seed
) seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subjects existing
  WHERE existing.institution_id = '0072cf6d-55a1-54e1-9a8c-767d8058f60a'::uuid
    AND existing.canonical_code = seed.course_code
)
;

-- Curriculum subject catalogue rows, idempotent on curriculum + semester + code.
INSERT INTO public.curriculum_subjects (
  id, curriculum_id, semester_id, subject_id, course_code, course_name, credits,
  course_type, mandatory, active, course_id, elective_group, created_at, updated_at
)
SELECT
  md5(c.id::text || ':' || seed.semester_number::text || ':' || seed.course_code)::uuid,
  c.id, sem.id, s.id,
  seed.course_code, seed.course_name, seed.credits, seed.course_type, seed.mandatory,
  TRUE, 'GECA-EPS-' || seed.course_code, seed.elective_group, NOW(), NOW()
FROM _geca_eps_course_seed seed
JOIN public.subjects s
  ON s.canonical_code = seed.course_code
 AND s.institution_id = '0072cf6d-55a1-54e1-9a8c-767d8058f60a'::uuid
JOIN public.curricula c ON c.specialization_id IN (
  SELECT id FROM public.specializations WHERE code = 'EPS'
)
JOIN public.semesters sem
  ON sem.curriculum_id = c.id AND sem.semester_number = seed.semester_number
ON CONFLICT (curriculum_id, semester_id, course_code) DO NOTHING;

-- Verification: counts by semester, including optional electives.
SELECT sp.name AS specialization, sem.semester_number,
       COUNT(cs.id) AS course_rows,
       COUNT(cs.id) FILTER (WHERE cs.mandatory) AS mandatory_rows,
       COUNT(cs.id) FILTER (WHERE NOT cs.mandatory) AS optional_rows
FROM public.curricula c
JOIN public.specializations sp ON sp.id = c.specialization_id
JOIN public.semesters sem ON sem.curriculum_id = c.id
LEFT JOIN public.curriculum_subjects cs
  ON cs.curriculum_id = c.id AND cs.semester_id = sem.id
WHERE sp.code = 'EPS'
GROUP BY sp.name, sem.semester_number
ORDER BY sem.semester_number;

COMMIT;
