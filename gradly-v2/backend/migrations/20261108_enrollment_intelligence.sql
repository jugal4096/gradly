-- Configurable enrollment-number classification and institutional progression rules.
CREATE TABLE IF NOT EXISTS public.enrollment_program_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  prefix VARCHAR(2) NOT NULL,
  programme_name_pattern TEXT NOT NULL,
  scheme_label TEXT NULL,
  duration_years SMALLINT NOT NULL CHECK (duration_years BETWEEN 1 AND 10),
  total_semesters SMALLINT NOT NULL CHECK (total_semesters BETWEEN 1 AND 20),
  regular_entry_semester SMALLINT NOT NULL DEFAULT 1,
  lateral_entry_semester SMALLINT NOT NULL DEFAULT 3,
  year_pivot_start SMALLINT NOT NULL DEFAULT 70 CHECK (year_pivot_start BETWEEN 0 AND 99),
  UNIQUE NULLS NOT DISTINCT (institution_id, prefix)
);

CREATE TABLE IF NOT EXISTS public.enrollment_admission_modes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  mode_code CHAR(1) NOT NULL,
  mode_name TEXT NOT NULL,
  entry_semester SMALLINT NOT NULL CHECK (entry_semester BETWEEN 1 AND 20),
  UNIQUE NULLS NOT DISTINCT (institution_id, mode_code)
);

CREATE TABLE IF NOT EXISTS public.enrollment_branch_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  branch_code CHAR(2) NOT NULL,
  branch_name TEXT NOT NULL,
  program_name_pattern TEXT NULL,
  UNIQUE NULLS NOT DISTINCT (institution_id, branch_code)
);

CREATE TABLE IF NOT EXISTS public.institution_academic_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  academic_year_start_month SMALLINT NOT NULL DEFAULT 7 CHECK (academic_year_start_month BETWEEN 1 AND 12),
  odd_semester_start_month SMALLINT NOT NULL DEFAULT 7 CHECK (odd_semester_start_month BETWEEN 1 AND 12),
  odd_semester_end_month SMALLINT NOT NULL DEFAULT 12 CHECK (odd_semester_end_month BETWEEN 1 AND 12),
  active_from DATE NULL,
  active_to DATE NULL,
  CHECK (active_to IS NULL OR active_from IS NULL OR active_to >= active_from)
);

CREATE INDEX IF NOT EXISTS idx_enrollment_program_rules_institution_prefix ON public.enrollment_program_rules(institution_id, prefix);
CREATE INDEX IF NOT EXISTS idx_enrollment_branch_codes_institution_code ON public.enrollment_branch_codes(institution_id, branch_code);
CREATE INDEX IF NOT EXISTS idx_institution_academic_calendars_active ON public.institution_academic_calendars(institution_id, active_from, active_to);

-- Configurable global programme aliases. Institution-specific rows can override these defaults.
INSERT INTO public.enrollment_program_rules
  (institution_id, prefix, programme_name_pattern, scheme_label, duration_years, total_semesters, regular_entry_semester, lateral_entry_semester, year_pivot_start)
VALUES
  (NULL, 'BE', '%Bachelor of Engineering%', 'New CBCS', 4, 8, 1, 3, 70),
  (NULL, 'BT', '%Bachelor of Technology%', 'New CBCS', 4, 8, 1, 3, 70),
  (NULL, 'MC', '%Master of Computer Applications%', NULL, 2, 4, 1, 1, 70),
  (NULL, 'MT', '%Master of Technology%', NULL, 2, 4, 1, 1, 70)
ON CONFLICT (institution_id, prefix) DO NOTHING;

-- Safe global defaults for admission markers and branch codes.
INSERT INTO public.enrollment_admission_modes (institution_id, mode_code, mode_name, entry_semester)
VALUES (NULL, 'F', 'Regular Admission', 1), (NULL, 'S', 'Direct Second Year', 3)
ON CONFLICT (institution_id, mode_code) DO NOTHING;

INSERT INTO public.enrollment_branch_codes (institution_id, branch_code, branch_name)
VALUES
  (NULL, '01', 'Civil Engineering'),
  (NULL, '02', 'Mechanical Engineering'),
  (NULL, '03', 'Electrical Engineering'),
  (NULL, '04', 'Electronics and Telecommunication Engineering'),
  (NULL, '05', 'Computer Science and Engineering'),
  (NULL, '06', 'Information Technology')
ON CONFLICT (institution_id, branch_code) DO NOTHING;
