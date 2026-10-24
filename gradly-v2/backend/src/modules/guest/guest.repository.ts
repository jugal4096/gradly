import { createHash, randomBytes, randomInt } from "crypto";
import { pool } from "../../config/database";

function hashGuestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createGuestSession(displayName: string) {
  const normalizedName = displayName.trim().replace(/\s+/g, " ");
  if (normalizedName.length < 3 || normalizedName.length > 24 || !/^[\p{L}\p{N} _.-]+$/u.test(normalizedName)) {
    throw new Error("Choose a display name between 3 and 24 characters using letters, numbers, spaces, dots, dashes or underscores.");
  }

  const client = await pool.connect();
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashGuestToken(rawToken);

  try {
    await client.query("BEGIN");
    // Serialize guest identity allocation so concurrent requests cannot claim the same name or display ID.
    await client.query("SELECT pg_advisory_xact_lock($1)", [43829011]);

    const nameCheck = await client.query(
      "SELECT id FROM guest_sessions WHERE lower(metadata->>'display_name') = lower($1) LIMIT 1",
      [normalizedName]
    );
    if (nameCheck.rows.length) {
      await client.query("ROLLBACK");
      const error = new Error("That guest display name is already taken. Please choose another.");
      (error as Error & { code?: string }).code = "GUEST_NAME_TAKEN";
      throw error;
    }

    let displayId = "";
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const candidate = String(randomInt(1000, 10000));
      const idCheck = await client.query(
        "SELECT id FROM guest_sessions WHERE metadata->>'display_id' = $1 LIMIT 1",
        [candidate]
      );
      if (!idCheck.rows.length) {
        displayId = candidate;
        break;
      }
    }
    if (!displayId) throw new Error("Unable to allocate a guest ID. Please try again.");

    const metadata = {
      source: "web",
      display_name: normalizedName,
      display_id: displayId,
      guest_workspace: { subjects: [], semesters: [], lastActiveCalculator: "sgpa" },
    };
    const result = await client.query(
      `INSERT INTO guest_sessions (session_token_hash, first_seen_at, last_seen_at, metadata)
       VALUES ($1, NOW(), NOW(), $2)
       RETURNING id, first_seen_at, last_seen_at, expires_at, metadata`,
      [tokenHash, JSON.stringify(metadata)]
    );
    await client.query("COMMIT");

    return { ...result.rows[0], sessionToken: rawToken };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* transaction may already be closed */ }
    throw error;
  } finally {
    client.release();
  }
}

export async function findGuestSessionByToken(sessionToken: string) {
  const tokenHash = hashGuestToken(sessionToken);
  const result = await pool.query(
    `SELECT id, first_seen_at, last_seen_at, expires_at, metadata
     FROM guest_sessions
     WHERE session_token_hash = $1 AND (expires_at IS NULL OR expires_at > NOW())
     LIMIT 1`,
    [tokenHash]
  );
  return result.rows[0] ?? null;
}

export async function updateGuestActivity(guestSessionId: string) {
  const result = await pool.query(
    `UPDATE guest_sessions SET last_seen_at = NOW()
     WHERE id = $1 RETURNING id, last_seen_at`,
    [guestSessionId]
  );
  return result.rows[0] ?? null;
}

export async function updateGuestWorkspace(guestSessionId: string, workspace: Record<string, unknown>) {
  const result = await pool.query(
    `UPDATE guest_sessions
     SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('guest_workspace', $2::jsonb),
         last_seen_at = NOW()
     WHERE id = $1
     RETURNING id, metadata, last_seen_at`,
    [guestSessionId, JSON.stringify(workspace)]
  );
  return result.rows[0] ?? null;
}

export async function listGuestBranchOptions() {
  const result = await pool.query(`
    SELECT DISTINCT b.id, b.name, p.name AS program_name, i.name AS institution_name
    FROM institutions i
    INNER JOIN programs p ON p.institution_id = i.id
    INNER JOIN branches b ON b.program_id = p.id
    ORDER BY i.name, p.name, b.name
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
    LIMIT 1
  `, [branchId]);
  const branch = branchResult.rows[0];
  if (!branch) return null;
  const metadata = {
    branch_id: branch.id,
    branch_name: branch.name,
    program_name: branch.program_name,
    institution_name: branch.institution_name,
  };
  const result = await pool.query(`
    UPDATE guest_sessions
    SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb, last_seen_at = NOW()
    WHERE id = $1
    RETURNING id, metadata, last_seen_at
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
    LIMIT 200
  `, [guestSessionId]);
  return result.rows;
}

export async function recordGuestActivity(guestSessionId: string, action: string, metadata: Record<string, unknown> = {}) {
  await pool.query(`
    INSERT INTO audit_logs (actor_type, actor_id, actor_role, action, entity_table, entity_id, metadata)
    VALUES ('GUEST', $1, 'GUEST', $2, 'guest_sessions', $1, $3::jsonb)
  `, [guestSessionId, action, JSON.stringify(metadata)]);
}
