-- GECA postgraduate programme structure for Gradly.
-- Adds M.Tech, its department-specific branches, and specializations.
-- Existing B.Tech/MCA records are not modified.
-- Syllabus records are intentionally imported in a separate migration after
-- each official curriculum's scheme, academic year, and course list are verified.

BEGIN;

-- 1. Register the M.Tech programme if it is not already present.
INSERT INTO public.programs (
  id, institution_id, name, short_name, level,
  duration_semesters, active, created_at, updated_at
)
SELECT
  'a4f77a0a-02e1-4c54-9f75-7b913f60a001'::uuid,
  '0072cf6d-55a1-54e1-9a8c-767d8058f60a'::uuid,
  'Master of Technology',
  'M.Tech',
  'POSTGRADUATE',
  4,
  TRUE,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM public.programs
  WHERE institution_id = '0072cf6d-55a1-54e1-9a8c-767d8058f60a'::uuid
    AND (name = 'Master of Technology' OR short_name = 'M.Tech')
)
ON CONFLICT DO NOTHING;

-- 2. Add M.Tech Civil and Applied Mechanics as separate departments.
INSERT INTO public.branches (
  id, program_id, name, code, active, created_at, updated_at
)
SELECT
  'a4f77a0a-02e1-4c54-9f75-7b913f60a002'::uuid,
  p.id, 'CIVIL', 'CIVIL', TRUE, NOW(), NOW()
FROM public.programs p
WHERE p.institution_id = '0072cf6d-55a1-54e1-9a8c-767d8058f60a'::uuid
  AND (p.name = 'Master of Technology' OR p.short_name = 'M.Tech')
ON CONFLICT (program_id, name) DO NOTHING;

INSERT INTO public.branches (
  id, program_id, name, code, active, created_at, updated_at
)
SELECT
  'b5f77a0a-02e1-4c54-9f75-7b913f60a003'::uuid,
  p.id, 'APPLIED MECHANICS', 'APPLIED_MECHANICS', TRUE, NOW(), NOW()
FROM public.programs p
WHERE p.institution_id = '0072cf6d-55a1-54e1-9a8c-767d8058f60a'::uuid
  AND (p.name = 'Master of Technology' OR p.short_name = 'M.Tech')
ON CONFLICT (program_id, name) DO NOTHING;

-- 3. Specializations are scoped to a programme and its department.
CREATE TABLE IF NOT EXISTS public.specializations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT specializations_program_branch_code_key
    UNIQUE (program_id, branch_id, code)
);

-- Link a curriculum to a specialization when applicable; existing curricula
-- remain valid because this column is nullable.
ALTER TABLE public.curricula
  ADD COLUMN IF NOT EXISTS specialization_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'curricula_specialization_id_fkey'
      AND conrelid = 'public.curricula'::regclass
  ) THEN
    ALTER TABLE public.curricula
      ADD CONSTRAINT curricula_specialization_id_fkey
      FOREIGN KEY (specialization_id)
      REFERENCES public.specializations(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS curricula_specialization_id_idx
  ON public.curricula(specialization_id);

-- 4. Civil department specializations.
INSERT INTO public.specializations (program_id, branch_id, name, code)
SELECT p.id, b.id, s.name, s.code
FROM public.programs p
JOIN public.branches b ON b.program_id = p.id AND b.name = 'CIVIL'
CROSS JOIN (
  VALUES
    ('Water Resources Engineering', 'WRE'),
    ('Geotechnical Engineering', 'GTE')
) AS s(name, code)
WHERE p.institution_id = '0072cf6d-55a1-54e1-9a8c-767d8058f60a'::uuid
  AND (p.name = 'Master of Technology' OR p.short_name = 'M.Tech')
ON CONFLICT (program_id, branch_id, code) DO NOTHING;

-- 5. Structural Engineering is listed under Applied Mechanics in GECA's
-- published M.Tech Structural Engineering curriculum.
INSERT INTO public.specializations (program_id, branch_id, name, code)
SELECT p.id, b.id, 'Structural Engineering', 'STRUCTURAL'
FROM public.programs p
JOIN public.branches b
  ON b.program_id = p.id
 AND b.name = 'APPLIED MECHANICS'
WHERE p.institution_id = '0072cf6d-55a1-54e1-9a8c-767d8058f60a'::uuid
  AND (p.name = 'Master of Technology' OR p.short_name = 'M.Tech')
ON CONFLICT (program_id, branch_id, code) DO NOTHING;

COMMIT;
