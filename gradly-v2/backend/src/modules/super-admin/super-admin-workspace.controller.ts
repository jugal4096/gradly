import type { Response } from "express";
import type { SuperAdminAuthenticatedRequest } from "../../middleware/super-admin-auth.middleware";
import { pool } from "../../config/database";

const PAGE_SIZE = 100;
const MODULES = new Set(["institutions", "curriculum", "audit", "feedback"]);

function getSearch(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 120) : "";
}

/**
 * Read-only, allow-listed Super Admin workspace data.
 * Every request is protected by authenticateSuperAdminToken in the router.
 */
export async function getSuperAdminWorkspace(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  const moduleName = req.params.module;
  if (!req.superAdmin) {
    return res.status(401).json({ success: false, message: "Super Admin authentication required." });
  }
  if (!MODULES.has(moduleName)) {
    return res.status(404).json({ success: false, message: "This workspace module is not connected to a live data source yet." });
  }

  const search = getSearch(req.query.search);
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), PAGE_SIZE);

  try {
    let result;
    if (moduleName === "institutions") {
      result = await pool.query(
        `SELECT i.id, i.name, i.active,
                COUNT(DISTINCT p.id)::int AS program_count,
                COUNT(DISTINCT b.id)::int AS branch_count
         FROM public.institutions i
         LEFT JOIN public.programs p ON p.institution_id = i.id
         LEFT JOIN public.branches b ON b.program_id = p.id
         WHERE ($1 = '' OR i.name ILIKE '%' || $1 || '%')
         GROUP BY i.id, i.name, i.active
         ORDER BY i.name ASC LIMIT $2`,
        [search, limit]
      );
    } else if (moduleName === "curriculum") {
      result = await pool.query(
        `SELECT id, institution_id, branch_id, status, created_at
         FROM public.curriculum_change_requests
         WHERE ($1 = '' OR COALESCE(status, '') ILIKE '%' || $1 || '%'
                OR COALESCE(institution_id::text, '') ILIKE '%' || $1 || '%')
         ORDER BY created_at DESC NULLS LAST LIMIT $2`,
        [search, limit]
      );
    } else if (moduleName === "audit") {
      result = await pool.query(
        `SELECT id, actor_role, actor_type, actor_id, action, entity_table,
                entity_id, metadata, created_at
         FROM public.audit_logs
         WHERE ($1 = '' OR COALESCE(action, '') ILIKE '%' || $1 || '%'
                OR COALESCE(actor_role, '') ILIKE '%' || $1 || '%'
                OR COALESCE(entity_table, '') ILIKE '%' || $1 || '%')
         ORDER BY created_at DESC LIMIT $2`,
        [search, limit]
      );
    } else {
      result = await pool.query(
        `SELECT id, status, created_at
         FROM public.feedback_requests
         WHERE ($1 = '' OR COALESCE(status, '') ILIKE '%' || $1 || '%'
                OR COALESCE(id::text, '') ILIKE '%' || $1 || '%')
         ORDER BY created_at DESC NULLS LAST LIMIT $2`,
        [search, limit]
      );
    }

    return res.status(200).json({
      success: true,
      module: moduleName,
      count: result.rows.length,
      data: result.rows,
      limit,
      readOnly: true,
    });
  } catch (error) {
    console.error(`Super Admin workspace read failed [${moduleName}]:`, error);
    return res.status(503).json({
      success: false,
      code: "WORKSPACE_DATA_UNAVAILABLE",
      message: "The workspace data could not be loaded. Check the database schema and backend logs; no demo data was substituted.",
    });
  }
}
