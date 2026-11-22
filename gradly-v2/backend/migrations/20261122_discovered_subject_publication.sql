ALTER TABLE public.discovered_result_subjects
  ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'DISCOVERED'
    CHECK (publication_status IN ('DISCOVERED','PUBLISHED')),
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_curriculum_subject_id uuid
    REFERENCES public.curriculum_subjects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS discovered_result_subjects_publication_idx
  ON public.discovered_result_subjects (publication_status, curriculum_id);

COMMENT ON COLUMN public.discovered_result_subjects.publication_status IS
  'DISCOVERED entries are pending review; PUBLISHED entries have a curriculum_subjects mapping.';
