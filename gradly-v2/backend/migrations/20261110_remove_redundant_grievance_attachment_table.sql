BEGIN;

-- The project already had student_enrollment_grievance_evidence with equivalent
-- secure BYTEA storage. The newly introduced duplicate table was unused.
DROP TABLE IF EXISTS public.student_enrollment_grievance_attachments;

COMMIT;
