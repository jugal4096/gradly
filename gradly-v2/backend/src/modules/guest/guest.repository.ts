import { createHash, randomBytes, randomInt } from "crypto";
import { pool } from "../../config/database";

function hashGuestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createGuestSession(guestIdInput: string, institutionIdInput: string, externalInstitution?: { name: string; locality: string; externalId?: string }) {
  const guestId = guestIdInput.trim().toUpperCase();
  if (guestId.length < 4 || guestId.length > 24 || !/^[A-Z0-9][A-Z0-9_-]*$/.test(guestId)) {
    throw new Error("Choose a Guest ID between 4 and 24 characters using letters, numbers, hyphens or underscores.");
  }
  if ((!institutionIdInput || typeof institutionIdInput !== "string") && !(externalInstitution?.name?.trim() && externalInstitution.locality?.trim())) {
    throw new Error("Select your institution to continue.");
  }

  const client = await pool.connect();
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashGuestToken(rawToken);

  try {
    await client.query("BEGIN");
    // Serialize ID claims; still check the database so existing and legacy IDs cannot collide.
    await client.query("SELECT pg_advisory_xact_lock($1)", [43829011]);

    const idCheck = await client.query(
      "SELECT id FROM guest_sessions WHERE lower(COALESCE(metadata->>'guest_id', metadata->>'display_id')) = lower($1) LIMIT 1",
      [guestId]
    );
    if (idCheck.rows.length) {
      const error = new Error("That Guest ID is already in use. Please choose another.");
      (error as Error & { code?: string }).code = "GUEST_ID_TAKEN";
      throw error;
    }

    let institution: { id: string | null; name: string; locality?: string; externalId?: string } | undefined;
    if (institutionIdInput) {
      const institutionResult = await client.query(
        "SELECT id, name FROM institutions WHERE id::text = $1 LIMIT 1",
        [institutionIdInput]
      );
      institution = institutionResult.rows[0];
    } else if (externalInstitution?.name?.trim() && externalInstitution.locality?.trim()) {
      institution = {
        id: null,
        name: externalInstitution.name.trim().slice(0, 160),
        locality: externalInstitution.locality.trim().slice(0, 160),
        externalId: externalInstitution.externalId?.trim().slice(0, 200),
      };
    }
    if (!institution) {
      const error = new Error("Please select an institution from the list or live search.");
      (error as Error & { code?: string }).code = "GUEST_INSTITUTION_INVALID";
      throw error;
    }

    const metadata = {
      source: "web",
      guest_id: guestId,
      display_id: guestId,
      display_name: guestId,
      institution_id: institution.id,
      institution_name: institution.name,
      institution_locality: institution.locality ?? null,
      institution_external_id: institution.externalId ?? null,
      institution_source: institution.id ? "GRADLY_DIRECTORY" : "OPENALEX",
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

export async function listGuestInstitutionOptions() {
  const result = await pool.query(
    "SELECT id, name FROM institutions ORDER BY name"
  );
  return result.rows;
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
