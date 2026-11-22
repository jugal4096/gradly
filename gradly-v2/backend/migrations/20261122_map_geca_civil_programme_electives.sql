-- GECA Civil NEP: populate Programme Elective I-V alternatives.
-- Source: official GECA NEP Civil curriculum (NEP_FYCIVIL.pdf), pages 11-13.
-- Notes:
--  * PE-I is Semester V; PE-II Semester VI; PE-III/IV/V Semester VII.
--  * Alternatives are non-mandatory PEC catalogue entries.
--  * Theory/lab pairings are stored in elective_pair_code.
--  * The source repeats CEPEC4006 for Solid Waste Management lab; the unique
--    (curriculum_id, semester_id, course_code) constraint prevents both rows.
--    Keep CEPEC4006 for Water Power Engineering lab; do not invent a replacement.
--  * PE-V AMPEC4010 and AMPEC4012 have no credit values in the source table;
--    omit them until the institute confirms their credits.

ALTER TABLE public.curriculum_subjects
  ADD COLUMN IF NOT EXISTS elective_pair_code text;

WITH course_data(course_code, course_name, semester_number, credits, elective_group, elective_pair_code) AS (
  VALUES
  ('AMPEC3001','Advanced Concrete Technology',5,3,'CIVIL_PE_I_THEORY','AMPEC3001'),
  ('CEPEC3001','Advanced Surveying',5,3,'CIVIL_PE_I_THEORY','CEPEC3001'),
  ('CEPEC3002','Town Planning',5,4,'CIVIL_PE_I_THEORY',NULL),
  ('CEPEC3003','Advanced Fluid Mechanics and Hydraulic Machinery',5,3,'CIVIL_PE_I_THEORY','CEPEC3003'),
  ('CEPEC3004','Advanced Water and Waste Water Treatment',5,3,'CIVIL_PE_I_THEORY','CEPEC3004'),
  ('AMPEC3002','Design of Precast and Composite Structures',5,3,'CIVIL_PE_I_THEORY','AMPEC3002'),
  ('AMPEC3003','Lab- Advanced Concrete Technology',5,1,'CIVIL_PE_I_LAB','AMPEC3001'),
  ('CEPEC3005','Lab-Advanced Surveying',5,1,'CIVIL_PE_I_LAB','CEPEC3001'),
  ('CEPEC3006','Lab- Advanced Fluid Mechanics and Hydraulic Machinery',5,1,'CIVIL_PE_I_LAB','CEPEC3003'),
  ('CEPEC3007','Lab-Advanced Water and Waste Water Treatment',5,1,'CIVIL_PE_I_LAB','CEPEC3004'),
  ('AMPEC3004','Design of Precast and Composite Structures',5,1,'CIVIL_PE_I_LAB','AMPEC3002'),

  ('CEPEC3008','Ground Improvement Techniques',6,3,'CIVIL_PE_II_THEORY','CEPEC3008'),
  ('CEPEC3009','Open Channel Hydraulics',6,3,'CIVIL_PE_II_THEORY','CEPEC3009'),
  ('AMPEC3005','Advanced Structural Analysis',6,4,'CIVIL_PE_II_THEORY',NULL),
  ('CEPEC3010','Air Pollution and Control',6,3,'CIVIL_PE_II_THEORY','CEPEC3010'),
  ('CEPEC3011','Advanced Transportation Engineering',6,3,'CIVIL_PE_II_THEORY','CEPEC3011'),
  ('CEPEC3012','Civil Engineering Laws',6,4,'CIVIL_PE_II_THEORY',NULL),
  ('AMPEC3006','Design of Advanced Steel Structures',6,3,'CIVIL_PE_II_THEORY','AMPEC3006'),
  ('CEPEC3013','Lab-Ground Improvement Techniques',6,1,'CIVIL_PE_II_LAB','CEPEC3008'),
  ('CEPEC3014','Lab-Open Channel Hydraulics',6,1,'CIVIL_PE_II_LAB','CEPEC3009'),
  ('CEPEC3015','Lab- Air Pollution and Control',6,1,'CIVIL_PE_II_LAB','CEPEC3010'),
  ('CEPEC3016','Lab- Advanced Transportation Engineering',6,1,'CIVIL_PE_II_LAB','CEPEC3011'),
  ('AMPEC3007','Lab - Design of Advanced Steel Structures',6,1,'CIVIL_PE_II_LAB','AMPEC3006'),

  ('AMPEC4001','Design of Bridges',7,3,'CIVIL_PE_III_THEORY','AMPEC4001'),
  ('CEPEC4001','Ground Water Engineering',7,3,'CIVIL_PE_III_THEORY','CEPEC4001'),
  ('CEPEC4002','Water Power Engineering',7,3,'CIVIL_PE_III_THEORY','CEPEC4002'),
  ('AMPEC4002','Design of Advanced RC Structures',7,3,'CIVIL_PE_III_THEORY','AMPEC4002'),
  ('CEPEC4003','Solid Waste Management',7,3,'CIVIL_PE_III_THEORY','CEPEC4003'),
  ('CEPEC4004','Construction Management',7,3,'CIVIL_PE_III_THEORY','CEPEC4004'),
  ('AMPEC4003','Lab-Design of Bridges',7,1,'CIVIL_PE_III_LAB','AMPEC4001'),
  ('CEPEC4005','Lab- Ground Water Engineering',7,1,'CIVIL_PE_III_LAB','CEPEC4001'),
  ('CEPEC4006','Lab-Water Power Engineering',7,1,'CIVIL_PE_III_LAB','CEPEC4002'),
  ('AMPEC4004','Lab- Design of Advanced RC Structures',7,1,'CIVIL_PE_III_LAB','AMPEC4002'),
  ('CEPEC4007','Lab- Construction Management',7,1,'CIVIL_PE_III_LAB','CEPEC4004'),

  ('AMPEC4005','Pre-stressed Concrete Design',7,3,'CIVIL_PE_IV_THEORY','AMPEC4005'),
  ('CEPEC4008','Industrial Waste Management',7,3,'CIVIL_PE_IV_THEORY','CEPEC4008'),
  ('CEPEC4009','Infrastructural Development',7,3,'CIVIL_PE_IV_THEORY','CEPEC4009'),
  ('CEPEC4010','Advanced Geotechnical Engineering',7,3,'CIVIL_PE_IV_THEORY','CEPEC4010'),
  ('AMPEC4006','Building Maintenance and Repairs',7,3,'CIVIL_PE_IV_THEORY','AMPEC4006'),
  ('AMPEC4007','Lab-Pre-stressed Concrete Design',7,1,'CIVIL_PE_IV_LAB','AMPEC4005'),
  ('CEPEC40111','Lab-Industrial Waste Management',7,1,'CIVIL_PE_IV_LAB','CEPEC4008'),
  ('CEPEC4012','Lab-Infrastructural Development',7,1,'CIVIL_PE_IV_LAB','CEPEC4009'),
  ('CEPEC4013','Lab-Advanced Geotechnical Engineering',7,1,'CIVIL_PE_IV_LAB','CEPEC4010'),
  ('AMPEC4008','Lab-Building Maintenance and Repairs',7,1,'CIVIL_PE_IV_LAB','AMPEC4006'),

  ('AMPEC4009','Earthquake Analysis and Design of Structures',7,3,'CIVIL_PE_V_THEORY','AMPEC4009'),
  ('CEPEC4014','Water Resources Systems and Management',7,3,'CIVIL_PE_V_THEORY','CEPEC4014'),
  ('CEPEC4015','Environmental Impact Assessment',7,3,'CIVIL_PE_V_THEORY','CEPEC4015'),
  ('CEPEC4016','Engineering Optimization',7,3,'CIVIL_PE_V_THEORY','CEPEC4016'),
  ('AMPEC4011','Lab-Earthquake Analysis and Design of Structures',7,1,'CIVIL_PE_V_LAB','AMPEC4009'),
  ('CEPEC4017','Lab-Water Resources Systems and Management',7,1,'CIVIL_PE_V_LAB','CEPEC4014'),
  ('CEPEC4018','Lab-Environmental Impact Assessment',7,1,'CIVIL_PE_V_LAB','CEPEC4015'),
  ('CEPEC4019','Lab-Engineering Optimization',7,1,'CIVIL_PE_V_LAB','CEPEC4016')
),
curriculum_context AS (
  SELECT id AS curriculum_id, institution_id
  FROM public.curricula
  WHERE id='61c84dee-22b4-5094-a6ec-ac192e6d5b18'
),
subject_upsert AS (
  INSERT INTO public.subjects(institution_id, canonical_code, canonical_name, active)
  SELECT cc.institution_id, d.course_code, d.course_name, true
  FROM course_data d CROSS JOIN curriculum_context cc
  ON CONFLICT (institution_id, canonical_code, canonical_name)
  DO UPDATE SET active=true, updated_at=now()
  RETURNING id, canonical_code, canonical_name
)
INSERT INTO public.curriculum_subjects(
  curriculum_id, semester_id, subject_id, course_code, course_name,
  credits, course_type, mandatory, elective_group, active, course_id,
  elective_pair_code
)
SELECT cc.curriculum_id, se.id, su.id, d.course_code, d.course_name,
       d.credits, 'PEC', false, d.elective_group, true, d.course_code,
       d.elective_pair_code
FROM course_data d
CROSS JOIN curriculum_context cc
JOIN public.semesters se
  ON se.curriculum_id=cc.curriculum_id AND se.semester_number=d.semester_number
JOIN subject_upsert su
  ON su.canonical_code=d.course_code AND su.canonical_name=d.course_name
ON CONFLICT (curriculum_id, semester_id, course_code)
DO UPDATE SET
  subject_id=EXCLUDED.subject_id,
  course_name=EXCLUDED.course_name,
  credits=EXCLUDED.credits,
  course_type='PEC',
  mandatory=false,
  elective_group=EXCLUDED.elective_group,
  active=true,
  course_id=EXCLUDED.course_id,
  elective_pair_code=EXCLUDED.elective_pair_code,
  updated_at=now();

UPDATE public.curriculum_subjects cs
SET mandatory=false,
    elective_group=CASE cs.course_code
      WHEN 'V1-053' THEN 'CIVIL_PE_I_SLOT'
      WHEN 'V1-054' THEN 'CIVIL_PE_I_LAB_SLOT'
      WHEN 'V1-065' THEN 'CIVIL_PE_II_SLOT'
      WHEN 'V1-066' THEN 'CIVIL_PE_II_LAB_SLOT'
      WHEN 'V1-069' THEN 'CIVIL_PE_III_SLOT'
      WHEN 'V1-070' THEN 'CIVIL_PE_III_LAB_SLOT'
      WHEN 'V1-072' THEN 'CIVIL_PE_IV_SLOT'
      WHEN 'V1-073' THEN 'CIVIL_PE_IV_LAB_SLOT'
      WHEN 'V1-074' THEN 'CIVIL_PE_V_SLOT'
      WHEN 'V1-075' THEN 'CIVIL_PE_V_LAB_SLOT'
    END,
    updated_at=now()
FROM public.semesters se
WHERE cs.semester_id=se.id
  AND cs.curriculum_id='61c84dee-22b4-5094-a6ec-ac192e6d5b18'
  AND (
    (se.semester_number=5 AND cs.course_code IN ('V1-053','V1-054')) OR
    (se.semester_number=6 AND cs.course_code IN ('V1-065','V1-066')) OR
    (se.semester_number=7 AND cs.course_code IN ('V1-069','V1-070','V1-072','V1-073','V1-074','V1-075'))
  );
