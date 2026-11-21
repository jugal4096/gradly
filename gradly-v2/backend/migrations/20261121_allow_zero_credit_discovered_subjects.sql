-- Some official curricula include legitimate zero-credit subjects.
ALTER TABLE public.discovered_result_subjects
  DROP CONSTRAINT IF EXISTS discovered_result_subjects_credits_check;
ALTER TABLE public.discovered_result_subjects
  ADD CONSTRAINT discovered_result_subjects_credits_nonnegative
  CHECK (credits >= 0 AND credits <= 30);
