BEGIN;

-- Evidence is served by authenticated backend routes; do not expose file bytes
-- directly through the Supabase Data API.
ALTER TABLE public.student_enrollment_grievance_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.student_enrollment_grievance_evidence FROM anon, authenticated;

COMMIT;
