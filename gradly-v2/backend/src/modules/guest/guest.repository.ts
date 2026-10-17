import { createHash, randomBytes } from "crypto";
import { pool } from "../../config/database";

function hashGuestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createGuestSession() {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashGuestToken(rawToken);

  const query = `
    INSERT INTO guest_sessions (
      session_token_hash,
      first_seen_at,
      last_seen_at,
      metadata
    )
    VALUES ($1, NOW(), NOW(), $2)
    RETURNING
      id,
      first_seen_at,
      last_seen_at,
      expires_at;
  `;

  const result = await pool.query(query, [
    tokenHash,
    JSON.stringify({
      source: "web",
    }),
  ]);

  return {
    ...result.rows[0],
    sessionToken: rawToken,
  };
}

export async function findGuestSessionByToken(sessionToken: string) {
  const tokenHash = hashGuestToken(sessionToken);

  const query = `
    SELECT
      id,
      first_seen_at,
      last_seen_at,
      expires_at
    FROM guest_sessions
    WHERE session_token_hash = $1
      AND (
        expires_at IS NULL
        OR expires_at > NOW()
      )
    LIMIT 1;
  `;

  const result = await pool.query(query, [tokenHash]);

  return result.rows[0] ?? null;
}

export async function updateGuestActivity(guestSessionId: string) {
  const query = `
    UPDATE guest_sessions
    SET last_seen_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      last_seen_at;
  `;

  const result = await pool.query(query, [guestSessionId]);

  return result.rows[0] ?? null;
}