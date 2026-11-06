-- Official AISHE-derived institution registry. Import the current AISHE directory export
-- into this table; do not treat third-party academic graph data as an official registry.
CREATE TABLE IF NOT EXISTS public.aishe_institution_directory (
  id BIGSERIAL PRIMARY KEY,
  aishe_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  district TEXT,
  city TEXT,
  category TEXT,
  institution_type TEXT,
  affiliation TEXT,
  website TEXT,
  management TEXT,
  source_year TEXT,
  source_url TEXT NOT NULL DEFAULT 'https://dashboard.aishe.gov.in/hedirectory/',
  verified BOOLEAN NOT NULL DEFAULT TRUE,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_aishe_institution_name ON public.aishe_institution_directory USING GIN (to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS idx_aishe_institution_location ON public.aishe_institution_directory (state, district);
CREATE INDEX IF NOT EXISTS idx_aishe_institution_affiliation ON public.aishe_institution_directory (affiliation);
