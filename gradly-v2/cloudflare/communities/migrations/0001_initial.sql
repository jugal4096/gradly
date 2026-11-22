-- Gradly Communities — D1 initial schema
-- SQLite / Cloudflare D1. Apply once to the empty gradly-communities database.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS chat_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  email_verified_at TEXT,
  avatar_url TEXT,
  institution_name TEXT,
  branch_name TEXT,
  semester INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','banned','deleted')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS chat_email_verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES chat_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_email_verifications_user ON chat_email_verifications(user_id);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES chat_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id, expires_at);

CREATE TABLE IF NOT EXISTS chat_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'study' CHECK (category IN ('college','department','semester','subject','study','other')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private','invite_only')),
  institution_name TEXT,
  branch_name TEXT,
  semester INTEGER,
  created_by TEXT NOT NULL REFERENCES chat_users(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','disabled')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_groups_discovery ON chat_groups(status, visibility, category, created_at DESC);

CREATE TABLE IF NOT EXISTS chat_group_members (
  group_id TEXT NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES chat_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','moderator','member')),
  joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  muted_until TEXT,
  last_read_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','left','removed','banned')),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_group_members(user_id, status);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES chat_users(id),
  body TEXT NOT NULL DEFAULT '',
  reply_to_id TEXT REFERENCES chat_messages(id) ON DELETE SET NULL,
  edited_at TEXT,
  deleted_at TEXT,
  deleted_by TEXT REFERENCES chat_users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (length(body) <= 5000)
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_group_time ON chat_messages(group_id, created_at DESC);

CREATE TABLE IF NOT EXISTS chat_message_reactions (
  message_id TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES chat_users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (message_id, user_id, reaction)
);

CREATE TABLE IF NOT EXISTS chat_message_attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  uploader_id TEXT NOT NULL REFERENCES chat_users(id),
  object_key TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  media_kind TEXT NOT NULL CHECK (media_kind IN ('image','video','document')),
  duration_seconds INTEGER,
  resource_category TEXT CHECK (resource_category IN ('notes','pyqs','assignments','syllabus','lab_manuals','presentations','other')),
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_attachments_group ON chat_message_attachments(group_id, created_at DESC);

CREATE TABLE IF NOT EXISTS chat_message_reads (
  message_id TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES chat_users(id) ON DELETE CASCADE,
  read_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_join_requests (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES chat_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  reviewed_by TEXT REFERENCES chat_users(id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_group_invites (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL COLLATE NOCASE,
  invited_by TEXT NOT NULL REFERENCES chat_users(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS chat_pinned_messages (
  group_id TEXT NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  pinned_by TEXT NOT NULL REFERENCES chat_users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(group_id, message_id)
);

CREATE TABLE IF NOT EXISTS chat_reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES chat_users(id),
  group_id TEXT REFERENCES chat_groups(id) ON DELETE SET NULL,
  message_id TEXT REFERENCES chat_messages(id) ON DELETE SET NULL,
  reported_user_id TEXT REFERENCES chat_users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  assigned_to TEXT REFERENCES chat_users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS chat_platform_roles (
  user_id TEXT NOT NULL REFERENCES chat_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('platform_admin','super_admin')),
  granted_by TEXT REFERENCES chat_users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(user_id, role)
);

CREATE TABLE IF NOT EXISTS chat_account_restrictions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES chat_users(id) ON DELETE CASCADE,
  restriction TEXT NOT NULL CHECK (restriction IN ('mute','suspend','ban')),
  reason TEXT NOT NULL,
  expires_at TEXT,
  created_by TEXT NOT NULL REFERENCES chat_users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  lifted_at TEXT,
  lifted_by TEXT REFERENCES chat_users(id)
);

CREATE TABLE IF NOT EXISTS chat_moderation_actions (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES chat_users(id),
  group_id TEXT REFERENCES chat_groups(id) ON DELETE SET NULL,
  target_user_id TEXT REFERENCES chat_users(id) ON DELETE SET NULL,
  target_message_id TEXT REFERENCES chat_messages(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS chat_audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES chat_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  reason TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_audit_created ON chat_audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS chat_platform_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_by TEXT REFERENCES chat_users(id),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT OR IGNORE INTO chat_platform_settings(key, value_json) VALUES
('limits', '{"maxGroupMemberships":20,"maxGroupMembers":500,"maxMessageLength":5000,"messagesPerMinute":10,"photosPerMessage":10,"photoBytes":5242880,"videoBytes":26214400,"videoSeconds":120,"pdfBytes":15728640,"officeBytes":10485760,"userStorageBytes":104857600,"uploadsPerDay":20,"videosPerDay":3}'),
('features', '{"emailVerificationRequired":true,"privateMessageInspection":"reported-case-only"}');
