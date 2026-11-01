-- Gradly: explicitly store the program assigned to an Admin.
-- Department/branch must belong to the selected program and institution.
ALTER TABLE public.admin_applications
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id);

ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id);

-- Backfill the program from the selected department/branch.
UPDATE public.admin_applications aa
SET program_id = b.program_id
FROM public.branches b
WHERE aa.branch_id = b.id
  AND aa.program_id IS NULL;

UPDATE public.admins a
SET program_id = b.program_id
FROM public.branches b
WHERE a.branch_id = b.id
  AND a.program_id IS NULL;

CREATE INDEX IF NOT EXISTS admin_applications_program_id_idx
  ON public.admin_applications(program_id);

CREATE INDEX IF NOT EXISTS admins_program_id_idx
  ON public.admins(program_id);
