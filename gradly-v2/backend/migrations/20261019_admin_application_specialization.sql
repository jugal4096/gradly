-- Store the selected M.Tech stream on admin applications.
ALTER TABLE public.admin_applications
  ADD COLUMN IF NOT EXISTS specialization_id UUID
  REFERENCES public.specializations(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS admin_applications_specialization_id_idx
  ON public.admin_applications(specialization_id);
