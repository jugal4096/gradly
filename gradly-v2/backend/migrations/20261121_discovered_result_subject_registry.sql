-- First-user-confirmed subject credits are stored once per curriculum.
CREATE TABLE IF NOT EXISTS public.discovered_result_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_id uuid NOT NULL REFERENCES public.curricula(id) ON DELETE CASCADE,
  course_code text NOT NULL,
  course_name text NOT NULL,
  course_category text NOT NULL DEFAULT 'UNCLASSIFIED',
  credits numeric(5,2) NOT NULL CHECK (credits > 0 AND credits <= 30),
  credit_status text NOT NULL DEFAULT 'FIRST_USER_CONFIRMED'
    CHECK (credit_status IN ('FIRST_USER_CONFIRMED', 'SUPER_ADMIN_VERIFIED')),
  confirmed_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'RESULT_PDF',
  semester_number integer NOT NULL CHECK (semester_number BETWEEN 1 AND 12),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discovered_result_subjects_curriculum_code_unique UNIQUE (curriculum_id, course_code)
);
CREATE INDEX IF NOT EXISTS discovered_result_subjects_code_idx
  ON public.discovered_result_subjects (course_code);

-- This table is accessed only through authenticated backend endpoints.
-- Keep the public Data API closed and use RLS as defense in depth.
ALTER TABLE public.discovered_result_subjects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.discovered_result_subjects FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.discovered_result_subjects TO service_role;
