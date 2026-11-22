CREATE TABLE IF NOT EXISTS chat_socket_tickets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES chat_users(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES chat_groups(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_socket_tickets_expiry ON chat_socket_tickets(expires_at, consumed_at);