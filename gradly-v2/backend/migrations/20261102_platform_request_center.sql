-- Central Request Center: one auditable workflow for Admin-originated requests.
CREATE TABLE IF NOT EXISTS public.platform_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_admin_id UUID NOT NULL REFERENCES public.admins(id) ON DELETE RESTRICT,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
  program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  request_type TEXT NOT NULL CHECK (request_type IN (
    'USER_DISABLE','USER_REACTIVATE','USER_DELETE','USER_REVIEW',
    'SYSTEM_CHANGE','BUG_REPORT','FEATURE_REQUEST','CURRICULUM_CHANGE','ACCOUNT_ACCESS','OTHER'
  )),
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  target_user_id TEXT,
  priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','IN_REVIEW','NEEDS_INFO','APPROVED','REJECTED','COMPLETED')),
  review_note TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_platform_requests_status_created ON public.platform_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_requests_admin_created ON public.platform_requests(requester_admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_requests_unacknowledged ON public.platform_requests(created_at DESC) WHERE acknowledged_at IS NULL;
CREATE TABLE IF NOT EXISTS public.platform_request_events (
  id BIGSERIAL PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.platform_requests(id) ON DELETE CASCADE,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('ADMIN','SUPER_ADMIN','SYSTEM')),
  actor_id UUID,
  event_type TEXT NOT NULL,
  note TEXT,
  from_status TEXT,
  to_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_platform_request_events_request ON public.platform_request_events(request_id, created_at ASC);
