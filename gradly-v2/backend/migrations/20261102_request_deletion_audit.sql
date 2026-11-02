-- Preserve a snapshot before Super Admin deletes a request from the unified inbox.
CREATE TABLE IF NOT EXISTS public.request_record_deletion_audit (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('platform','password','curriculum','student','feedback','institution')),
  record_id TEXT NOT NULL,
  record_snapshot JSONB NOT NULL,
  event_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  deleted_by UUID NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_request_deletion_audit_deleted_at
  ON public.request_record_deletion_audit(deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_deletion_audit_source_record
  ON public.request_record_deletion_audit(source, record_id);
