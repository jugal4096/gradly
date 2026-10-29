import type { Response } from "express";
import { pool } from "../../config/database";
import type { SuperAdminAuthenticatedRequest } from "../../middleware/super-admin-auth.middleware";

function boundedInteger(value: unknown, fallback: number, maximum: number) {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0
    ? Math.min(parsed, maximum)
    : fallback;
}

/** Read-only, paginated audit feed. Raw metadata is intentionally omitted. */
export async function getSuperAdminAuditLogs(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  const limit = Math.max(1, boundedInteger(req.query.limit, 25, 100));
  const offset = boundedInteger(req.query.offset, 0, 1000000);
  const search = typeof req.query.search === "string"
    ? req.query.search.trim().slice(0, 120)
    : "";
  const actorRole = typeof req.query.actorRole === "string"
    ? req.query.actorRole.trim().slice(0, 64)
    : "";

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (search) {
    values.push(`%${search.replace(/[\\%_]/g, "\\$&")}%`);
    const index = values.length;
    conditions.push(`(
      action ILIKE $${index} ESCAPE '\\'
      OR COALESCE(actor_role, '') ILIKE $${index} ESCAPE '\\'
      OR COALESCE(entity_table, '') ILIKE $${index} ESCAPE '\\'
      OR COALESCE(entity_id::text, '') ILIKE $${index} ESCAPE '\\'
      OR COALESCE(actor_id::text, '') ILIKE $${index} ESCAPE '\\'
    )`);
  }

  if (actorRole) {
    values.push(actorRole);
    conditions.push(`actor_role = $${values.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM public.audit_logs ${whereClause}`,
      values
    );
    const listValues = [...values, limit, offset];
    const rowsResult = await pool.query(
      `SELECT
         id,
         actor_type AS "actorType",
         actor_id AS "actorId",
         actor_role AS "actorRole",
         action,
         entity_table AS "entityTable",
         entity_id AS "entityId",
         ip_address AS "ipAddress",
         created_at AS "createdAt"
       FROM public.audit_logs
       ${whereClause}
       ORDER BY created_at DESC, id DESC
       LIMIT $${listValues.length - 1}
       OFFSET $${listValues.length}`,
      listValues
    );

    return res.status(200).json({
      success: true,
      data: {
        items: rowsResult.rows,
        page: {
          limit,
          offset,
          total: Number(countResult.rows[0]?.total ?? 0),
          hasMore: offset + rowsResult.rows.length < Number(countResult.rows[0]?.total ?? 0),
        },
      },
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: "Audit logs are temporarily unavailable.",
    });
  }
}
