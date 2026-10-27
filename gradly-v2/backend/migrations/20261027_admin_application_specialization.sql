-- Keep admin application queries aligned with the optional M.Tech specialization feature.
-- Existing applications remain valid because the field is nullable.
ALTER TABLE public.admin_applications
  ADD COLUMN IF NOT EXISTS specialization_id UUID NULL;

-- Add referential integrity when the specializations table exists and the
-- relationship has not already been installed.
DO $$
BEGIN
  IF to_regclass('public.specializations') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'admin_applications_specialization_id_fkey'
         AND conrelid = 'public.admin_applications'::regclass
     )
  THEN
    ALTER TABLE public.admin_applications
      ADD CONSTRAINT admin_applications_specialization_id_fkey
      FOREIGN KEY (specialization_id)
      REFERENCES public.specializations(id)
      ON DELETE SET NULL;
  END IF;
END
$$;
