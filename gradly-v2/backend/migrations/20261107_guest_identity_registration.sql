-- Persistent guest identity is represented by the existing UUID primary key in guest_sessions.
-- Guest ID is a public display identifier; the UUID remains the internal identity.
CREATE UNIQUE INDEX IF NOT EXISTS guest_sessions_guest_id_unique_idx
ON public.guest_sessions (lower(COALESCE(metadata->>'guest_id', metadata->>'display_id')))
WHERE COALESCE(metadata->>'account_status', 'ACTIVE') <> 'DELETED'
  AND COALESCE(metadata->>'guest_id', metadata->>'display_id') IS NOT NULL;

CREATE INDEX IF NOT EXISTS guest_sessions_last_seen_idx
ON public.guest_sessions (last_seen_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_guest_activity_timeline_idx
ON public.audit_logs (actor_id, created_at DESC)
WHERE actor_type = 'GUEST';

ALTER TABLE public.guest_institution_requests
  ADD COLUMN IF NOT EXISTS guest_session_id UUID REFERENCES public.guest_sessions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS guest_institution_requests_guest_timeline_idx
  ON public.guest_institution_requests (guest_session_id, created_at DESC)
  WHERE guest_session_id IS NOT NULL;
