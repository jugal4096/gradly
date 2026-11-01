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
  const limit = boundedInteger(req.query.limit, 50, 100) || 50;
  const offset = boundedInteger(req.query.offset, 0, 1000000);
  try {
    const result = await pool.query(
      `SELECT id, first_seen_at, last_seen_at, expires_at,
              COALESCE(metadata->>'guest_id', metadata->>'display_id') AS guest_id,
              metadata->>'display_name' AS display_name,
              metadata->>'institution_name' AS institution_name,
              jsonb_array_length(CASE WHEN jsonb_typeof(metadata->'guest_workspace'->'subjects') = 'array'
                THEN metadata->'guest_workspace'->'subjects' ELSE '[]'::jsonb END) AS subject_count,
              jsonb_array_length(CASE WHEN jsonb_typeof(metadata->'guest_workspace'->'semesters') = 'array'
                THEN metadata->'guest_workspace'->'semesters' ELSE '[]'::jsonb END) AS semester_entry_count
       FROM guest_sessions
       ORDER BY last_seen_at DESC NULLS LAST
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const count = await pool.query("SELECT COUNT(*)::int AS total FROM guest_sessions");
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
        workspace: guest.metadata?.guest_workspace ?? { subjects: [], semesters: [], lastActiveCalculator: "sgpa" },
      },
      activity: activity.rows,
    });
  } catch (error) {
    console.error("Failed to load guest session details for Super Admin:", error);
    return res.status(500).json({ message: "Failed to load guest session details." });
  }
}
