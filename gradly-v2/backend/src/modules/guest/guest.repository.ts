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

export async function listGuestBranchOptions() {
  const result = await pool.query(`
    SELECT DISTINCT b.id, b.name, p.name AS program_name, i.name AS institution_name
    FROM institutions i
    INNER JOIN programs p ON p.institution_id = i.id
    INNER JOIN branches b ON b.program_id = p.id
    ORDER BY i.name, p.name, b.name;
  `);
  return result.rows;
}

export async function setGuestBranch(guestSessionId: string, branchId: string) {
  const branchResult = await pool.query(`
    SELECT b.id, b.name, p.name AS program_name, i.name AS institution_name
    FROM branches b
    INNER JOIN programs p ON p.id = b.program_id
    INNER JOIN institutions i ON i.id = p.institution_id
    WHERE b.id::text = $1
    LIMIT 1;
  `, [branchId]);
  const branch = branchResult.rows[0];
  if (!branch) return null;
  const metadata = {
    branch_id: branch.id,
    branch_name: branch.name,
    program_name: branch.program_name,
    institution_name: branch.institution_name
  };
  const result = await pool.query(`
    UPDATE guest_sessions
    SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
        last_seen_at = NOW()
    WHERE id = $1
    RETURNING id, metadata, last_seen_at;
  `, [guestSessionId, JSON.stringify(metadata)]);
  if (!result.rows[0]) return null;
  await recordGuestActivity(guestSessionId, "GUEST_BRANCH_SELECTED", metadata);
  return { ...result.rows[0], branch };
}

export async function findGuestActivity(guestSessionId: string) {
  const result = await pool.query(`
    SELECT id, actor_type, actor_role, action, entity_table, entity_id, created_at, metadata
    FROM audit_logs
    WHERE actor_id::text = $1::text AND actor_type = 'GUEST'
    ORDER BY created_at DESC
    LIMIT 200;
  `, [guestSessionId]);
  return result.rows;
}

export async function recordGuestActivity(guestSessionId: string, action: string, metadata: Record<string, unknown> = {}) {
  await pool.query(`
    INSERT INTO audit_logs (actor_type, actor_id, actor_role, action, entity_table, entity_id, metadata)
    VALUES ('GUEST', $1, 'GUEST', $2, 'guest_sessions', $1, $3::jsonb);
  `, [guestSessionId, action, JSON.stringify(metadata)]);
}
