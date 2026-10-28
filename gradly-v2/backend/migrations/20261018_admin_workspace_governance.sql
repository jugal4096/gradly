-- Admin workspace governance: subject change requests, graduation-based expiry, and notifications.
-- Apply through the project's normal migration process after reviewing the target database.

ALTER TABLE public.admin_applications
  ADD COLUMN IF NOT EXISTS graduation_completion_date DATE;

ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS graduation_completion_date DATE,
  ADD COLUMN IF NOT EXISTS admin_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS adminship_extended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS adminship_extended_by UUID;

-- Preserve application-declared graduation date when an approved application
-- is provisioned. Existing administrators remain unchanged until reviewed.
CREATE INDEX IF NOT EXISTS idx_admins_admin_expires_at
  ON public.admins (admin_expires_at)
  WHERE status = 'ACTIVE' AND admin_expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.admin_subject_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  curriculum_id UUID REFERENCES public.curricula(id) ON DELETE SET NULL,
  semester_id UUID REFERENCES public.semesters(id) ON DELETE SET NULL,
  curriculum_subject_id UUID REFERENCES public.curriculum_subjects(id) ON DELETE SET NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('ADD_SUBJECT', 'REMOVE_SUBJECT', 'MODIFY_SUBJECT')),
  reason TEXT NOT NULL,
  proposed_changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_subject_change_requests_admin
  ON public.admin_subject_change_requests (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_subject_change_requests_review
  ON public.admin_subject_change_requests (status, created_at ASC);

CREATE TABLE IF NOT EXISTS public.admin_workspace_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dedupe_key TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_admin_workspace_notifications_unread
  ON public.admin_workspace_notifications (admin_id, created_at DESC)
  WHERE read_at IS NULL;
