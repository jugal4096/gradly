-- Super Admin-managed semester catalogue, scoped to a program.
-- Apply this migration to the same PostgreSQL database used by Gradly backend.
CREATE TABLE IF NOT EXISTS public.program_semesters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE RESTRICT,
  semester_number INTEGER NOT NULL CHECK (semester_number BETWEEN 1 AND 20),
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (program_id, semester_number),
  UNIQUE (program_id, name)
);

CREATE INDEX IF NOT EXISTS program_semesters_program_id_idx
  ON public.program_semesters (program_id, semester_number);
