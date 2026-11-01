-- MCA applications are program-level and do not have a department/branch.
-- Keep M.Tech and other branch-based programs linked to their selected branch.
ALTER TABLE public.admin_applications
  ALTER COLUMN branch_id DROP NOT NULL;
