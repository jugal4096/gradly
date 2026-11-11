-- TO-09: immutable reviewer accountability and enrollment grievance decision history.
BEGIN;

CREATE TABLE IF NOT EXISTS public.student_enrollment_grievance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grievance_id UUID NOT NULL REFERENCES public.student_enrollment_grievances(id) ON DELETE RESTRICT,
  reviewer_id UUID NOT NULL,
  reviewer_role VARCHAR(32) NOT NULL,
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE RESTRICT,
  programme_scope TEXT,
  branch_scope TEXT,
  event_type VARCHAR(32) NOT NULL CHECK (event_type IN ('STATUS_CHANGED','INFORMATION_REQUESTED','DECISION_RECORDED','MAPPING_CORRECTED')),
  previous_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  old_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  new_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision_reason TEXT NOT NULL CHECK (char_length(BTRIM(decision_reason)) BETWEEN 3 AND 2000),
  information_request TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS student_enrollment_grievance_events_grievance_created_idx
  ON public.student_enrollment_grievance_events (grievance_id, created_at DESC);
CREATE INDEX IF NOT EXISTS student_enrollment_grievance_events_reviewer_created_idx
  ON public.student_enrollment_grievance_events (reviewer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS student_enrollment_grievance_events_institution_created_idx
  ON public.student_enrollment_grievance_events (institution_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.prevent_student_enrollment_grievance_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Enrollment grievance decision history is append-only';
END;
$$;

DROP TRIGGER IF EXISTS student_enrollment_grievance_events_no_update ON public.student_enrollment_grievance_events;
CREATE TRIGGER student_enrollment_grievance_events_no_update
  BEFORE UPDATE OR DELETE ON public.student_enrollment_grievance_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_student_enrollment_grievance_event_mutation();

COMMIT;
