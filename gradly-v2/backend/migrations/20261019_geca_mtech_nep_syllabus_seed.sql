-- GECA M.Tech NEP curriculum seed (effective AY 2023-24).
-- Sources:
-- Water Resources: https://geca.ac.in/pdf/curriculum/PG/civil/NEPWRECivilCurriculumWEF2324.pdf
-- Structural: https://geca.ac.in/pdf/curriculum/PG/applied%20mech/NEPStructuresAMCurricullumWEF2324.pdf
--
-- Elective catalogues are seeded as optional rows so Gradly can show all official
-- choices. They are not all simultaneously required for a student's credit total.
-- Curricula remain DRAFT until reviewed. academic_year_id is left NULL because
-- the exact academic_years schema/row was not supplied; assign it once verified.
-- Source semester tables: WRE NEP 2023-24 and Structural NEP 2023-24 PDFs linked above.
-- Apply this migration in Supabase SQL Editor; committing a file to GitHub does not
-- execute it against the live database.

BEGIN;

-- Create curriculum headers for Water Resources and Structural Engineering.
WITH wanted AS (
  SELECT
    'WRE'::text AS spec_code,
    'a4f77a0a-02e1-4c54-9f75-7b913f60a101'::uuid AS curriculum_id,
    'a4f77a0a-02e1-4c54-9f75-7b913f60a001'::uuid AS program_id,
    'CIVIL'::text AS branch_name,
    82::numeric AS total_credits
  UNION ALL
  SELECT
    'STRUCTURAL',
    'b5f77a0a-02e1-4c54-9f75-7b913f60a101'::uuid,
    'a4f77a0a-02e1-4c54-9f75-7b913f60a001'::uuid,
    'APPLIED MECHANICS',
    82::numeric
)
INSERT INTO public.curricula (
  id, institution_id, program_id, branch_id, scheme_id,
  grading_system_id, academic_year_id, specialization_id,
  version, status, total_semesters, total_credits, created_at, updated_at
)
SELECT
  w.curriculum_id,
  '0072cf6d-55a1-54e1-9a8c-767d8058f60a'::uuid,
  p.id,
  b.id,
  'bd65c899-2c56-5166-bcb9-8945030e1277'::uuid,
  '2925d20a-df5c-5e3f-b7b2-57f557bde6a4'::uuid,
  NULL,
  sp.id,
  1,
  'DRAFT',
  4,
  w.total_credits,
  NOW(),
  NOW()
FROM wanted w
JOIN public.programs p
  ON p.id = w.program_id
JOIN public.branches b
  ON b.program_id = p.id AND b.name = w.branch_name
JOIN public.specializations sp
  ON sp.program_id = p.id AND sp.branch_id = b.id AND sp.code = w.spec_code
WHERE NOT EXISTS (
  SELECT 1 FROM public.curricula c WHERE c.id = w.curriculum_id
);

-- Add semester records (stable IDs).
INSERT INTO public.semesters
  (id, curriculum_id, semester_number, active, created_at, updated_at)
SELECT
  md5(c.id::text || ':semester:' || n)::uuid,
  c.id,
  n,
  TRUE,
  NOW(),
  NOW()
FROM public.curricula c
CROSS JOIN generate_series(1, 4) AS n
WHERE c.id IN (
  'a4f77a0a-02e1-4c54-9f75-7b913f60a101'::uuid,
  'b5f77a0a-02e1-4c54-9f75-7b913f60a101'::uuid
)
ON CONFLICT (curriculum_id, semester_number) DO NOTHING;

-- Official course catalog. All alternative programme/open electives are kept
-- optional, with their official codes and credits.
CREATE TEMP TABLE _geca_mtech_course_seed (
  spec_code text NOT NULL,
  semester_number integer NOT NULL,
  course_code text NOT NULL,
  course_name text NOT NULL,
  credits numeric NOT NULL,
  course_type text NOT NULL,
  mandatory boolean NOT NULL,
  elective_group text
) ON COMMIT DROP;

INSERT INTO _geca_mtech_course_seed VALUES
-- WATER RESOURCES ENGINEERING: SEMESTER I
('WRE',1,'CERMC5001','Research Methodology',4,'THEORY',TRUE,NULL),
('WRE',1,'CEPCC5001','Computational and Statistical Methods',3,'THEORY',TRUE,NULL),
('WRE',1,'CEPCC5002','Engineering Hydrology and Hydrologic Systems',3,'THEORY',TRUE,NULL),
('WRE',1,'CEPEC5001','Groundwater Engineering',4,'ELECTIVE',FALSE,'WRE-PEC-I'),
('WRE',1,'CEPEC5002','Channel and River Hydraulic',4,'ELECTIVE',FALSE,'WRE-PEC-I'),
('WRE',1,'CEPEC5003','Urban Storm Water Management',4,'ELECTIVE',FALSE,'WRE-PEC-I'),
('WRE',1,'CEPEC5004','Rural and Urban Water Supply',4,'ELECTIVE',FALSE,'WRE-PEC-I'),
('WRE',1,'CEPEC5005','Planning and Design of Hydro Power Systems',4,'ELECTIVE',FALSE,'WRE-PEC-II'),
('WRE',1,'CEPEC5006','Micro Irrigation',4,'ELECTIVE',FALSE,'WRE-PEC-II'),
('WRE',1,'CEPEC5007','GIS Applications in Water Resources Engineering',4,'ELECTIVE',FALSE,'WRE-PEC-II'),
('WRE',1,'CEPEC5008','River Basin Management',4,'ELECTIVE',FALSE,'WRE-PEC-II'),
('WRE',1,'CEVSE5001','Mini Project',2,'PROJECT',TRUE,NULL),
('WRE',1,'CEPCC5003','Water Resources Software Laboratory',2,'PRACTICAL',TRUE,NULL),
('WRE',1,'INCCC5001','Stress Management by Yoga / Club Activity',0,'AUDIT',FALSE,NULL),

-- WATER RESOURCES ENGINEERING: SEMESTER II
('WRE',2,'CEPCC5004','Advanced Fluid Mechanics',3,'THEORY',TRUE,NULL),
('WRE',2,'CEPCC5005','Water Resources Systems Planning and Management',4,'THEORY',TRUE,NULL),
('WRE',2,'CEPCC5006','Hydraulic Structures',3,'THEORY',TRUE,NULL),
('WRE',2,'CEPEC5009','Water Supply Systems',3,'ELECTIVE',FALSE,'WRE-PEC-III'),
('WRE',2,'CEPEC5010','Environmental Impact Assessment',3,'ELECTIVE',FALSE,'WRE-PEC-III'),
('WRE',2,'CEPEC5011','Climate Change and Water Resources',3,'ELECTIVE',FALSE,'WRE-PEC-III'),
('WRE',2,'CEPEC5012','River Engineering and Flood Control',3,'ELECTIVE',FALSE,'WRE-PEC-III'),
('WRE',2,'CEPEC5013','Integrated Watershed Management',3,'ELECTIVE',FALSE,'WRE-PEC-IV'),
('WRE',2,'CEPEC5014','Land and Water Management',3,'ELECTIVE',FALSE,'WRE-PEC-IV'),
('WRE',2,'CEPEC5015','Water Quality Monitoring and Modeling',3,'ELECTIVE',FALSE,'WRE-PEC-IV'),
('WRE',2,'AMOEC5001','Basics of Finite Element Analysis',3,'ELECTIVE',FALSE,'WRE-OE-I'),
('WRE',2,'CSOEC5002','Professional Ethics and Cyber Law',3,'ELECTIVE',FALSE,'WRE-OE-I'),
('WRE',2,'CEOEC5003','Engineering Optimization',3,'ELECTIVE',FALSE,'WRE-OE-I'),
('WRE',2,'MEOEC5004','Robotics',3,'ELECTIVE',FALSE,'WRE-OE-I'),
('WRE',2,'EEOEC5005','Electric Vehicles',3,'ELECTIVE',FALSE,'WRE-OE-I'),
('WRE',2,'ECOEC5006','IoT for Smart Systems',3,'ELECTIVE',FALSE,'WRE-OE-I'),
('WRE',2,'CEPCC5007','Water Technology Laboratory',1,'PRACTICAL',TRUE,NULL),
('WRE',2,'CEPCC5008','Water Resources Systems Planning and Management Laboratory',1,'PRACTICAL',TRUE,NULL),
('WRE',2,'EEAEC5001','Technical Presentation',3,'THEORY',TRUE,NULL),
('WRE',2,'CEVSE5002','Mini Project',2,'PROJECT',TRUE,NULL),

-- WATER RESOURCES ENGINEERING: SEMESTER III
('WRE',3,'AMOEC6001','Indian Constitution',3,'ELECTIVE',FALSE,'WRE-OE-II'),
('WRE',3,'CSOEC6002','Data Science',3,'ELECTIVE',FALSE,'WRE-OE-II'),
('WRE',3,'CEOEC6003','Disaster Management',3,'ELECTIVE',FALSE,'WRE-OE-II'),
('WRE',3,'MEOEC6004','Additive Manufacturing',3,'ELECTIVE',FALSE,'WRE-OE-II'),
('WRE',3,'EEOEC6005','Smart Grid Systems',3,'ELECTIVE',FALSE,'WRE-OE-II'),
('WRE',3,'ECOEC6006','Soft Computing',3,'ELECTIVE',FALSE,'WRE-OE-II'),
('WRE',3,'CEIKS6001','Ancient Water Management Practices',3,'THEORY',TRUE,NULL),
('WRE',3,'CEDIS6001','Dissertation-I',10,'PROJECT',TRUE,NULL),
('WRE',3,'CEPCC5009','Engineering Hydrology Laboratory',2,'PRACTICAL',TRUE,NULL),
('WRE',3,'MEEEM6001','Entrepreneurship Development',3,'ELECTIVE',FALSE,'WRE-EEM-III'),
('WRE',3,'ECEEM6002','Engineering Economics',3,'ELECTIVE',FALSE,'WRE-EEM-III'),
('WRE',3,'MEEEM6003','Industrial Management',3,'ELECTIVE',FALSE,'WRE-EEM-III'),

-- WATER RESOURCES ENGINEERING: SEMESTER IV
('WRE',4,'CEDIS6002','Dissertation-II',16,'PROJECT',TRUE,NULL),

-- STRUCTURAL ENGINEERING: SEMESTER I
('STRUCTURAL',1,'AMPCC5001','Theory of Elasticity and Plasticity',3,'THEORY',TRUE,NULL),
('STRUCTURAL',1,'AMPCC5002','Structural Dynamics and Earthquake Engineering',4,'THEORY',TRUE,NULL),
('STRUCTURAL',1,'AMPCC5003','Structural Dynamics and Earthquake Engineering Laboratory',1,'PRACTICAL',TRUE,NULL),
('STRUCTURAL',1,'AMPEC5004','Prestressed Concrete Design',4,'ELECTIVE',FALSE,'STR-PEC-I'),
('STRUCTURAL',1,'AMPEC5005','Advance Concrete Technology',4,'ELECTIVE',FALSE,'STR-PEC-I'),
('STRUCTURAL',1,'AMPEC5006','Numerical Methods and Optimization Techniques',4,'ELECTIVE',FALSE,'STR-PEC-I'),
('STRUCTURAL',1,'AMPEC5007','Project Planning & Management',4,'ELECTIVE',FALSE,'STR-PEC-I'),
('STRUCTURAL',1,'AMPEC5008','Design of Bridges',4,'ELECTIVE',FALSE,'STR-PEC-II'),
('STRUCTURAL',1,'AMPEC5009','Stability of Structure',4,'ELECTIVE',FALSE,'STR-PEC-II'),
('STRUCTURAL',1,'AMPEC5010','Soil Structure Interaction',4,'ELECTIVE',FALSE,'STR-PEC-II'),
('STRUCTURAL',1,'AMPEC5011','Advance Structural Analysis',4,'ELECTIVE',FALSE,'STR-PEC-II'),
('STRUCTURAL',1,'AMVSEC5012','Mini Project-I',2,'PROJECT',TRUE,NULL),
('STRUCTURAL',1,'MERMC5001','Research Methodology',4,'THEORY',TRUE,NULL),
('STRUCTURAL',1,'INCCC5001','Stress Management by Yoga / Club Activity',0,'AUDIT',FALSE,NULL),

-- STRUCTURAL ENGINEERING: SEMESTER II
('STRUCTURAL',2,'AMPCC5101','Finite Element Method',4,'THEORY',TRUE,NULL),
('STRUCTURAL',2,'AMPCC5102','Theory of Plates & Shells',4,'THEORY',TRUE,NULL),
('STRUCTURAL',2,'AMPCC5103','Design of Advance RC Structures',4,'THEORY',TRUE,NULL),
('STRUCTURAL',2,'AMPEC5104','Advance Seismic Analysis & Design',3,'ELECTIVE',FALSE,'STR-PEC-III'),
('STRUCTURAL',2,'AMPEC5105','Mechanics of Composite Materials',3,'ELECTIVE',FALSE,'STR-PEC-III'),
('STRUCTURAL',2,'AMPEC5106','Design of Advance Steel Structure',3,'ELECTIVE',FALSE,'STR-PEC-III'),
('STRUCTURAL',2,'AMPEC5107','Fracture Mechanics',3,'ELECTIVE',FALSE,'STR-PEC-IV'),
('STRUCTURAL',2,'AMPEC5108','Design of High-rise Structures',3,'ELECTIVE',FALSE,'STR-PEC-IV'),
('STRUCTURAL',2,'AMPEC5109','Structural Assessments & Rehabilitations',3,'ELECTIVE',FALSE,'STR-PEC-IV'),
('STRUCTURAL',2,'AMOEC5110','Basics of Finite Element Analysis',3,'ELECTIVE',FALSE,'STR-OE-I'),
('STRUCTURAL',2,'CSOEC5002','Professional Ethics and Cyber Law',3,'ELECTIVE',FALSE,'STR-OE-I'),
('STRUCTURAL',2,'CEOEC5003','Engineering Optimization',3,'ELECTIVE',FALSE,'STR-OE-I'),
('STRUCTURAL',2,'MEOEC5004','Robotics',3,'ELECTIVE',FALSE,'STR-OE-I'),
('STRUCTURAL',2,'EEOEC5005','Electric Vehicles',3,'ELECTIVE',FALSE,'STR-OE-I'),
('STRUCTURAL',2,'ECOEC5006','IoT for Smart Systems',3,'ELECTIVE',FALSE,'STR-OE-I'),
('STRUCTURAL',2,'AMVSEC5111','Mini Project-II',2,'PROJECT',TRUE,NULL),
('STRUCTURAL',2,'EEAEC5001','Technical Presentation',3,'THEORY',TRUE,NULL),

-- STRUCTURAL ENGINEERING: SEMESTER III
('STRUCTURAL',3,'AMOEC6001','Indian Constitution',3,'ELECTIVE',FALSE,'STR-OE-II'),
('STRUCTURAL',3,'CSOEC6002','Data Science',3,'ELECTIVE',FALSE,'STR-OE-II'),
('STRUCTURAL',3,'CEOEC6003','Disaster Management',3,'ELECTIVE',FALSE,'STR-OE-II'),
('STRUCTURAL',3,'MEOEC6004','Additive Manufacturing',3,'ELECTIVE',FALSE,'STR-OE-II'),
('STRUCTURAL',3,'EEOEC6005','Smart Grid Systems',3,'ELECTIVE',FALSE,'STR-OE-II'),
('STRUCTURAL',3,'ECOEC6006','Soft Computing',3,'ELECTIVE',FALSE,'STR-OE-II'),
('STRUCTURAL',3,'MEEEM6001','Entrepreneurship Development',3,'ELECTIVE',FALSE,'STR-EEM-III'),
('STRUCTURAL',3,'ECEEM6002','Engineering Economics',3,'ELECTIVE',FALSE,'STR-EEM-III'),
('STRUCTURAL',3,'MEEEM6003','Industrial Management',3,'ELECTIVE',FALSE,'STR-EEM-III'),
('STRUCTURAL',3,'CEIKS6001','Ancient Water Management Practices',3,'ELECTIVE',FALSE,'STR-IKS-III'),
('STRUCTURAL',3,'AMDIS6003','Dissertation-I',10,'PROJECT',TRUE,NULL),
('STRUCTURAL',3,'AMIKS6004','Indian Knowledge System',2,'THEORY',TRUE,NULL),

-- STRUCTURAL ENGINEERING: SEMESTER IV
('STRUCTURAL',4,'AMDIS6101','Dissertation-II',16,'PROJECT',TRUE,NULL);

-- Ensure canonical subject rows exist. Gradly stores course-specific codes and
-- stable IDs on curriculum_subjects, while subjects provides the referenced row.
INSERT INTO public.subjects (
  id, institution_id, canonical_code, canonical_name, active, created_at, updated_at
)
SELECT DISTINCT
  md5('GECA-SUBJECT:' || course_code)::uuid,
  '0072cf6d-55a1-54e1-9a8c-767d8058f60a'::uuid,
  course_code,
  course_name,
  TRUE,
  NOW(),
  NOW()
FROM _geca_mtech_course_seed
ON CONFLICT (id) DO NOTHING;

-- Insert curriculum subject rows idempotently.
INSERT INTO public.curriculum_subjects (
  id, curriculum_id, semester_id, subject_id,
  course_code, course_name, credits, course_type,
  mandatory, active, course_id, elective_group, created_at, updated_at
)
SELECT
  md5(c.id::text || ':' || s.semester_number::text || ':' || seed.course_code)::uuid,
  c.id,
  sem.id,
  md5('GECA-SUBJECT:' || seed.course_code)::uuid,
  seed.course_code,
  seed.course_name,
  seed.credits,
  seed.course_type,
  seed.mandatory,
  TRUE,
  'GECA-' || seed.spec_code || '-' || seed.course_code,
  seed.elective_group,
  NOW(),
  NOW()
FROM _geca_mtech_course_seed seed
JOIN public.specializations sp ON sp.code = seed.spec_code
JOIN public.curricula c ON c.specialization_id = sp.id
JOIN public.semesters sem
  ON sem.curriculum_id = c.id
 AND sem.semester_number = seed.semester_number
WHERE c.id IN (
  'a4f77a0a-02e1-4c54-9f75-7b913f60a101'::uuid,
  'b5f77a0a-02e1-4c54-9f75-7b913f60a101'::uuid
)
ON CONFLICT (curriculum_id, semester_id, course_code) DO NOTHING;

-- Summary: verify courses by specialization and semester.
SELECT
  sp.name AS specialization,
  sem.semester_number,
  COUNT(cs.id) AS seeded_course_rows,
  SUM(cs.credits) FILTER (WHERE cs.mandatory) AS mandatory_credits_in_rows,
  SUM(cs.credits) AS credits_if_all_rows_counted
FROM public.curricula c
JOIN public.specializations sp ON sp.id = c.specialization_id
JOIN public.semesters sem ON sem.curriculum_id = c.id
LEFT JOIN public.curriculum_subjects cs
  ON cs.curriculum_id = c.id
 AND cs.semester_id = sem.id
WHERE c.id IN (
  'a4f77a0a-02e1-4c54-9f75-7b913f60a101'::uuid,
  'b5f77a0a-02e1-4c54-9f75-7b913f60a101'::uuid
)
GROUP BY sp.name, sem.semester_number
ORDER BY sp.name, sem.semester_number;

COMMIT;
