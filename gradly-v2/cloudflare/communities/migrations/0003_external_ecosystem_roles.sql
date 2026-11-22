CREATE TABLE IF NOT EXISTS chat_external_roles (
  identity_type TEXT NOT NULL CHECK(identity_type IN ('admin','super_admin')),
  identity_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('platform_admin','super_admin')),
  granted_by_type TEXT NOT NULL DEFAULT 'super_admin',
  granted_by_id TEXT,
  granted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  revoked_at TEXT,
  revoked_by_id TEXT,
  PRIMARY KEY(identity_type,identity_id)
);
CREATE INDEX IF NOT EXISTS idx_chat_external_roles_role ON chat_external_roles(role,identity_type,revoked_at);