-- Super Admin student lifecycle controls and in-app student notifications.
-- Apply this migration to the production PostgreSQL database before enabling the UI.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_active_students
  ON public.users (active, created_at DESC)
  WHERE role = 'STUDENT' AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.student_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL DEFAULT 'GENERAL',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_notifications_inbox
  ON public.student_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_notifications_unread
  ON public.student_notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;
