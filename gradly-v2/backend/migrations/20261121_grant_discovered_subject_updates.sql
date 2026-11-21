-- Allow the authenticated backend service role to update an already discovered
-- subject when a student confirms a corrected title or credit value.
GRANT UPDATE ON TABLE public.discovered_result_subjects TO service_role;
