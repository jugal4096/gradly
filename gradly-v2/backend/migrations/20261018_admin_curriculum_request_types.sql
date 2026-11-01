-- Extend Admin proposals to curriculum-level governance actions.
-- Apply with the normal migration process before using these request types.
ALTER TABLE public.admin_subject_change_requests
  DROP CONSTRAINT IF EXISTS admin_subject_change_requests_request_type_check;

ALTER TABLE public.admin_subject_change_requests
  ADD CONSTRAINT admin_subject_change_requests_request_type_check
  CHECK (request_type IN (
    'ADD_SUBJECT', 'REMOVE_SUBJECT', 'MODIFY_SUBJECT',
    'RENAME_CURRICULUM', 'DELETE_CURRICULUM'
  ));
