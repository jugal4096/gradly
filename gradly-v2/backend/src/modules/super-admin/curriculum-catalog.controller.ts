import type { Response } from "express";
import type { SuperAdminAuthenticatedRequest } from "../../middleware/super-admin-auth.middleware";
import { pool } from "../../config/database";

const clean = (value: unknown, max = 120) => typeof value === "string" ? value.trim().slice(0, max) : "";

/**
 * Cross-institution curriculum catalogue for Super Admin.
 * The catalogue is read-only; filters are applied by the database.
 */
export async function listCurriculumCatalog(req: SuperAdminAuthenticatedRequest, res: Response) {
  if (!req.superAdmin) return res.status(401).json({ success: false, message: "Super Admin authentication required." });

  const institutionId = clean(req.query.institutionId);
  const programId = clean(req.query.programId);
  const branchId = clean(req.query.branchId);
  const search = clean(req.query.search, 160);
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);

  try {
    const result = await pool.query(`
      SELECT
        c.id::text AS id,
        COALESCE(to_jsonb(c)->>'name', to_jsonb(c)->>'title', to_jsonb(c)->>'curriculum_name', 'Curriculum') AS curriculum_name,
        c.program_id::text AS program_id,
        p.name AS program_name,
        i.id::text AS institution_id,
        i.name AS institution_name,
        b.id::text AS branch_id,
        b.name AS branch_name,
        to_jsonb(c)->>'status' AS status,
        to_jsonb(c)->>'academic_year' AS academic_year,
        to_jsonb(c)->>'version' AS version
      FROM public.curricula c
      JOIN public.programs p ON p.id = c.program_id
      JOIN public.institutions i ON i.id = p.institution_id
      LEFT JOIN public.branches b ON b.program_id = p.id
      WHERE ($1 = '' OR i.id::text = $1)
        AND ($2 = '' OR p.id::text = $2)
        AND ($3 = '' OR b.id::text = $3)
        AND ($4 = '' OR
          i.name ILIKE '%' || $4 || '%' OR
          p.name ILIKE '%' || $4 || '%' OR
          COALESCE(b.name, '') ILIKE '%' || $4 || '%' OR
          COALESCE(to_jsonb(c)->>'name', '') ILIKE '%' || $4 || '%' OR
          COALESCE(to_jsonb(c)->>'title', '') ILIKE '%' || $4 || '%' OR
          c.id::text ILIKE '%' || $4 || '%')
      ORDER BY i.name, p.name, b.name NULLS FIRST, curriculum_name
      LIMIT $5
    `, [institutionId, programId, branchId, search, limit]);

    return res.status(200).json({ success: true, data: result.rows, count: result.rows.length, limit, readOnly: true });
  } catch (error) {
    console.error("Super Admin curriculum catalogue failed:", error);
    return res.status(503).json({
      success: false,
      code: "CURRICULUM_CATALOG_UNAVAILABLE",
      message: "The curriculum catalogue could not be loaded. Check that the curricula table and academic relationships are available; no sample data was substituted."
    });
  }
}
