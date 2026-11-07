import type { Response } from "express";
import { pool } from "../../config/database";
import type { SuperAdminAuthenticatedRequest } from "../../middleware/super-admin-auth.middleware";

function boundedInteger(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

async function auditGuestAccess(req: SuperAdminAuthenticatedRequest, action: string, guestSessionId: string) {
  const superAdminId = req.superAdmin?.superAdminId;
  if (!superAdminId) return;
  await pool.query(
    `INSERT INTO audit_logs (actor_type, actor_id, actor_role, action, entity_table, entity_id, metadata)
     VALUES ('SUPER_ADMIN', $1, 'SUPER_ADMIN', $2, 'guest_sessions', $3, $4::jsonb)`,
    [superAdminId, action, guestSessionId, JSON.stringify({ accessSurface: "super-admin-guest-review" })]
  );
}

export async function listGuestSessionsForSuperAdmin(req: SuperAdminAuthenticatedRequest, res: Response) {
  if (!req.superAdmin?.superAdminId) return res.status(401).json({ message: "Super Admin authentication required." });
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
  const institution = typeof req.query.institution === "string" ? req.query.institution.trim().slice(0, 120) : "";
  const status = typeof req.query.status === "string" ? req.query.status.toUpperCase() : "";
  const from = typeof req.query.from === "string" ? req.query.from : "";
  const to = typeof req.query.to === "string" ? req.query.to : "";
  const sort = req.query.sort === "registered" ? "first_seen_at" : "last_seen_at";
  const values: unknown[] = [];
  const where: string[] = [];
  const add = (value: unknown) => { values.push(value); return "$" + values.length; };
  if (search) where.push("(COALESCE(metadata->>'guest_id',metadata->>'display_id') ILIKE " + add("%"+search+"%") + " OR COALESCE(metadata->>'institution_name','') ILIKE $" + values.length + ")");
  if (institution) where.push("COALESCE(metadata->>'institution_name','') ILIKE " + add("%"+institution+"%"));
  if (status === "ACTIVE" || status === "DISABLED") where.push("COALESCE(metadata->>'account_status','ACTIVE') = " + add(status));
  if (from) where.push("first_seen_at >= " + add(from));
  if (to) where.push("first_seen_at < (" + add(to) + "::date + INTERVAL '1 day')");
  const clause = where.length ? "WHERE " + where.join(" AND ") : "";
  try {
    const pageValues = [...values, limit, offset];
    const result = await pool.query(
      `SELECT gs.id, gs.first_seen_at, gs.last_seen_at, gs.expires_at,
        COALESCE(gs.metadata->>'guest_id',gs.metadata->>'display_id') AS guest_id,
        gs.metadata->>'display_name' AS display_name,
        gs.metadata->>'institution_id' AS institution_id,
        gs.metadata->>'institution_name' AS institution_name,
        gs.metadata->>'institution_locality' AS institution_locality,
        gs.metadata->>'account_status' AS account_status,
        COALESCE((SELECT COUNT(*) FROM audit_logs al WHERE al.actor_type='GUEST' AND al.actor_id=gs.id),0)::int AS activity_count,
        COALESCE((SELECT COUNT(*) FROM guest_institution_requests ir WHERE ir.guest_session_id=gs.id),0)::int AS institute_request_count,
        jsonb_array_length(CASE WHEN jsonb_typeof(gs.metadata->'guest_workspace'->'subjects')='array' THEN gs.metadata->'guest_workspace'->'subjects' ELSE '[]'::jsonb END) AS subject_count,
        jsonb_array_length(CASE WHEN jsonb_typeof(gs.metadata->'guest_workspace'->'semesters')='array' THEN gs.metadata->'guest_workspace'->'semesters' ELSE '[]'::jsonb END) AS semester_entry_count
       FROM guest_sessions gs ${clause}
       ORDER BY gs.${sort} DESC NULLS LAST LIMIT $${values.length+1} OFFSET $${values.length+2}`,
      pageValues
    );
    const count = await pool.query(`SELECT COUNT(*)::int AS total FROM guest_sessions gs ${clause}`, values);
    return res.status(200).json({ guests: result.rows, total: count.rows[0]?.total ?? 0, limit, offset });
  } catch (error) {
    console.error("Failed to list guest sessions for Super Admin:", error);
    return res.status(500).json({ message: "Failed to load guest sessions." });
  }
}

export async function getGuestSessionForSuperAdmin(req: SuperAdminAuthenticatedRequest, res: Response) {
  if (!req.superAdmin?.superAdminId) return res.status(401).json({ message: "Super Admin authentication required." });
  const guestSessionId = req.params.guestSessionId;
  try {
    const result = await pool.query(
      `SELECT id, first_seen_at, last_seen_at, expires_at, metadata
       FROM guest_sessions WHERE id::text = $1 LIMIT 1`,
      [guestSessionId]
    );
    const guest = result.rows[0];
    if (!guest) return res.status(404).json({ message: "Guest session not found." });
    await auditGuestAccess(req, "SUPER_ADMIN_VIEWED_GUEST_SESSION", guestSessionId);
    const activity = await pool.query(
      `SELECT id, action, entity_table, entity_id, created_at, metadata
       FROM audit_logs
       WHERE actor_id::text = $1::text AND actor_type = 'GUEST'
       ORDER BY created_at DESC LIMIT 200`,
      [guestSessionId]
    );
    const requests = await pool.query(
      `SELECT id, college_name, locality, state, city, district, institution_type, status, created_at, reviewed_at, reviewed_note
       FROM public.guest_institution_requests WHERE guest_session_id::text=$1
       ORDER BY created_at DESC LIMIT 100`,
      [guestSessionId]
    );
    return res.status(200).json({
      guest: {
        id: guest.id,
        guestId: guest.metadata?.guest_id ?? guest.metadata?.display_id ?? null,
        displayName: guest.metadata?.display_name ?? guest.metadata?.guest_id ?? "Guest",
        institutionId: guest.metadata?.institution_id ?? null,
        institutionName: guest.metadata?.institution_name ?? null,
        firstSeenAt: guest.first_seen_at,
        lastSeenAt: guest.last_seen_at,
        expiresAt: guest.expires_at,
        accountStatus: guest.metadata?.account_status ?? "ACTIVE",
        workspace: guest.metadata?.guest_workspace ?? { subjects: [], semesters: [], lastActiveCalculator: "sgpa" },
      },
      activity: activity.rows,
      instituteRequests: requests.rows,
    });
  } catch (error) {
    console.error("Failed to load guest session details for Super Admin:", error);
    return res.status(500).json({ message: "Failed to load guest session details." });
  }
}


export async function updateGuestAccountStatus(req: SuperAdminAuthenticatedRequest, res: Response) {
  const superAdminId = req.superAdmin?.superAdminId;
  if (!superAdminId) return res.status(401).json({ message: "Super Admin authentication required." });
  const status = typeof req.body?.status === "string" ? req.body.status.toUpperCase() : "";
  if (!["ACTIVE", "DISABLED"].includes(status)) return res.status(400).json({ message: "Status must be ACTIVE or DISABLED." });
  const guestId = req.params.guestSessionId;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE guest_sessions
       SET metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('account_status',$2,'status_changed_at',NOW(),'status_changed_by',$3),
           expires_at = CASE WHEN $2='DISABLED' THEN NOW() ELSE NULL END
       WHERE id::text=$1
       RETURNING id, metadata, expires_at`,
      [guestId, status, superAdminId]
    );
    if (!updated.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Guest account not found." }); }
    await client.query(
      `INSERT INTO audit_logs (actor_type,actor_id,actor_role,action,entity_table,entity_id,metadata)
       VALUES ('SUPER_ADMIN',$1,'SUPER_ADMIN',$2,'guest_sessions',$3,$4::jsonb)`,
      [superAdminId, status==="DISABLED"?"SUPER_ADMIN_DISABLED_GUEST":"SUPER_ADMIN_REACTIVATED_GUEST", guestId, JSON.stringify({ status })]
    );
    await client.query("COMMIT");
    return res.json({ message: status==="DISABLED"?"Guest account disabled and active session revoked.":"Guest account reactivated.", guest: updated.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to update guest status:", error);
    return res.status(500).json({ message: "Unable to update guest account status." });
  } finally { client.release(); }
}
