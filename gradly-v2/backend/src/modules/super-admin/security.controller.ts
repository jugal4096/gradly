import type { Response } from "express";
import { pool } from "../../config/database";
import type { SuperAdminAuthenticatedRequest } from "../../middleware/super-admin-auth.middleware";

function safeInteger(value: unknown, fallback: number, maximum: number) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? Math.min(parsed, maximum) : fallback;
}

/** Read-only security feed sourced from persisted login_attempts and login_security records. */
export async function getSuperAdminSecurityEvents(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  const limit = Math.max(1, safeInteger(req.query.limit, 25, 100));
  const offset = safeInteger(req.query.offset, 0, 1000000);
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 120) : "";
  const principalType = typeof req.query.principalType === "string" ? req.query.principalType.trim().slice(0, 32) : "";
  const outcome = typeof req.query.outcome === "string" ? req.query.outcome : "";

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (search) {
    values.push(`%${search}%`);
    const index = values.length;
    conditions.push(`(
      COALESCE(a.principal_id::text, '') ILIKE $${index}
      OR COALESCE(a.principal_type, '') ILIKE $${index}
      OR COALESCE(a.ip_address::text, '') ILIKE $${index}
      OR COALESCE(a.failure_reason, '') ILIKE $${index}
    )`);
  }

  if (principalType && ["SUPER_ADMIN", "ADMIN", "USER"].includes(principalType)) {
    values.push(principalType);
    conditions.push(`a.principal_type = $${values.length}`);
  }

  if (outcome === "failed" || outcome === "success") {
    values.push(outcome === "success");
    conditions.push(`a.success = $${values.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM public.login_attempts a ${whereClause}`,
      values
    );
    const summaryResult = await pool.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE success = FALSE AND created_at >= NOW() - INTERVAL '24 hours'
        )::int AS "failedLast24Hours",
        COUNT(*) FILTER (
          WHERE success = TRUE AND created_at >= NOW() - INTERVAL '24 hours'
        )::int AS "successfulLast24Hours"
      FROM public.login_attempts
    `);
    const listValues = [...values, limit, offset];
    const listResult = await pool.query(
      `SELECT
         a.id,
         a.principal_type AS "principalType",
         a.principal_id AS "principalId",
         a.success,
         a.ip_address::text AS "ipAddress",
         a.failure_reason AS "failureReason",
         a.created_at AS "createdAt",
         s.lockout_level AS "lockoutLevel",
         s.locked_until AS "lockedUntil"
       FROM public.login_attempts a
       LEFT JOIN public.login_security s
         ON s.principal_type = a.principal_type
        AND s.principal_id = a.principal_id
       ${whereClause}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT $${listValues.length - 1}
       OFFSET $${listValues.length}`,
      listValues
    );

    const items = listResult.rows.map((row) => ({
      ...row,
      severity: row.success
        ? "INFO"
        : row.lockedUntil && new Date(row.lockedUntil).getTime() > Date.now()
          ? "HIGH"
          : "MEDIUM",
    }));

    return res.status(200).json({
      success: true,
      data: {
        items,
        summary: summaryResult.rows[0] ?? { failedLast24Hours: 0, successfulLast24Hours: 0 },
        page: {
          limit,
          offset,
          total: Number(countResult.rows[0]?.total ?? 0),
          hasMore: offset + items.length < Number(countResult.rows[0]?.total ?? 0),
        },
      },
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: "Security events are temporarily unavailable.",
    });
  }
}
