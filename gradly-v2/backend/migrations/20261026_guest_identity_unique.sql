-- Ensure the human-readable Guest ID is unique, including legacy guest sessions.
-- Apply this migration after confirming the preflight query returns no rows.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM guest_sessions
    WHERE COALESCE(metadata->>'guest_id', metadata->>'display_id') IS NOT NULL
    GROUP BY lower(COALESCE(metadata->>'guest_id', metadata->>'display_id'))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce unique Guest IDs: duplicate IDs already exist in guest_sessions.';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS guest_sessions_guest_id_unique_idx
  ON guest_sessions (
    lower(COALESCE(metadata->>'guest_id', metadata->>'display_id'))
  )
  WHERE COALESCE(metadata->>'guest_id', metadata->>'display_id') IS NOT NULL;
