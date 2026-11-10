-- TO-06: private grievance evidence and immutable student-visible tracking events.
CREATE TABLE IF NOT EXISTS public.student_enrollment_grievance_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grievance_id UUID NOT NULL REFERENCES public.student_enrollment_grievances(id) ON DELETE CASCADE,
  student_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  original_filename VARCHAR(180) NOT NULL CHECK (char_length(original_filename) BETWEEN 1 AND 180),
  mime_type VARCHAR(40) NOT NULL CHECK (mime_type IN ('application/pdf','image/jpeg','image/png')),
  file_size INTEGER NOT NULL CHECK (file_size BETWEEN 1 AND 3145728),
  file_data BYTEA NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS student_grievance_evidence_owner_idx
  ON public.student_enrollment_grievance_evidence (grievance_id, student_user_id, uploaded_at);

CREATE TABLE IF NOT EXISTS public.student_enrollment_grievance_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  grievance_id UUID NOT NULL REFERENCES public.student_enrollment_grievances(id) ON DELETE CASCADE,
  actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('STUDENT','ADMIN','SUPER_ADMIN','SYSTEM')),
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('SUBMITTED','STATUS_CHANGED','EVIDENCE_UPLOADED','NOTE_ADDED')),
  from_status VARCHAR(20),
  to_status VARCHAR(20),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS student_grievance_events_timeline_idx
  ON public.student_enrollment_grievance_events (grievance_id, created_at, id);

ALTER TABLE public.student_enrollment_grievance_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_enrollment_grievance_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.record_student_enrollment_grievance_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.student_enrollment_grievance_events
      (grievance_id, actor_type, event_type, to_status, note)
    VALUES (NEW.id, 'SYSTEM', 'SUBMITTED', NEW.status, 'Grievance submitted');
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.student_enrollment_grievance_events
      (grievance_id, actor_type, event_type, from_status, to_status, note)
    VALUES (NEW.id, 'SYSTEM', 'STATUS_CHANGED', OLD.status, NEW.status, NEW.admin_response);
  ELSIF NEW.admin_response IS DISTINCT FROM OLD.admin_response AND NEW.admin_response IS NOT NULL THEN
    INSERT INTO public.student_enrollment_grievance_events
      (grievance_id, actor_type, event_type, note)
    VALUES (NEW.id, 'SYSTEM', 'NOTE_ADDED', NEW.admin_response);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS student_enrollment_grievance_event_insert
  ON public.student_enrollment_grievances;
CREATE TRIGGER student_enrollment_grievance_event_insert
AFTER INSERT ON public.student_enrollment_grievances
FOR EACH ROW EXECUTE FUNCTION public.record_student_enrollment_grievance_event();

DROP TRIGGER IF EXISTS student_enrollment_grievance_event_update
  ON public.student_enrollment_grievances;
CREATE TRIGGER student_enrollment_grievance_event_update
AFTER UPDATE OF status, admin_response ON public.student_enrollment_grievances
FOR EACH ROW EXECUTE FUNCTION public.record_student_enrollment_grievance_event();
