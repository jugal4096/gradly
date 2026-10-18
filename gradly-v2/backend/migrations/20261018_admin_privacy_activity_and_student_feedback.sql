-- Privacy-preserving Admin activity counts and student syllabus feedback.
-- Active means a session with authenticated activity in the last five minutes.
CREATE TABLE IF NOT EXISTS public.admin_active_user_sessions (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_active_user_sessions_scope_activity
  ON public.admin_active_user_sessions (institution_id, program_id, branch_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS public.student_syllabus_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  curriculum_id UUID REFERENCES public.curricula(id) ON DELETE SET NULL,
  scheme_name TEXT,
  semester_number INTEGER,
  subject_name TEXT,
  request_type TEXT NOT NULL DEFAULT 'SYLLABUS_CHANGE'
    CHECK (request_type IN ('SYLLABUS_CHANGE','SYLLABUS_FEEDBACK','MISSING_SUBJECT','CREDIT_CORRECTION','OTHER')),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 10 AND 3000),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','REVIEWED','FORWARDED','RESOLVED','REJECTED')),
  admin_review_note TEXT,
  reviewed_by_admin_id UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_student_syllabus_feedback_scope
  ON public.student_syllabus_feedback (institution_id, program_id, branch_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_syllabus_feedback_submitter
  ON public.student_syllabus_feedback (submitted_by_user_id, created_at DESC);
