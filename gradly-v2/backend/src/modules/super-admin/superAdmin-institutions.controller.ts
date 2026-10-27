import type { Response } from "express";
import { pool } from "../../config/database";
import type { SuperAdminAuthenticatedRequest } from "../../middleware/super-admin-auth.middleware";

export async function listInstitutionDirectory(
  _req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  try {
    const result = await pool.query(
      `SELECT
         i.id,
         i.name,
         COALESCE(to_jsonb(i)->>'city', to_jsonb(i)->>'location_city', to_jsonb(i)->>'locality', to_jsonb(i)->>'location') AS city,
         COALESCE(to_jsonb(i)->>'state', to_jsonb(i)->>'region') AS region,
         COALESCE(to_jsonb(i)->>'country', 'India') AS country,
         COUNT(DISTINCT p.id)::int AS program_count,
         COUNT(DISTINCT b.id)::int AS branch_count,
         COUNT(DISTINCT c.id)::int AS curriculum_count,
         COALESCE(
           jsonb_agg(DISTINCT jsonb_build_object(
             'id', p.id,
             'name', p.name,
             'code', to_jsonb(p)->>'code',
             'level', to_jsonb(p)->>'level',
             'active', COALESCE((to_jsonb(p)->>'active')::boolean, TRUE),
             'branchCount', (
               SELECT COUNT(*)::int FROM public.branches bx WHERE bx.program_id = p.id
             ),
             'branches', (
               SELECT COALESCE(jsonb_agg(jsonb_build_object(
                 'id', bx.id, 'name', bx.name, 'code', to_jsonb(bx)->>'code',
                 'active', COALESCE((to_jsonb(bx)->>'active')::boolean, TRUE)
               ) ORDER BY bx.name), '[]'::jsonb)
               FROM public.branches bx WHERE bx.program_id = p.id
             ),
             'curriculumCount', (
               SELECT COUNT(*)::int FROM public.curricula cx WHERE cx.program_id = p.id
             )
           )) FILTER (WHERE p.id IS NOT NULL),
           '[]'::jsonb
         ) AS programs
       FROM public.institutions i
       LEFT JOIN public.programs p ON p.institution_id = i.id
       LEFT JOIN public.branches b ON b.program_id = p.id
       LEFT JOIN public.curricula c ON c.institution_id = i.id AND c.program_id = p.id
       GROUP BY i.id, i.name
       ORDER BY i.name ASC
       LIMIT 2000`
    );
    return res.status(200).json({ success: true, institutions: result.rows, count: result.rows.length });
  } catch (error) {
    console.error("Failed to load institution directory:", error);
    return res.status(500).json({ success: false, message: "Could not load institutions and their programs from the database." });
  }
}

export async function listInstitutionAdditionRequests(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  try {
    const rawStatus = typeof req.query.status === "string" ? req.query.status.trim().toUpperCase() : "ALL";
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 160) : "";
    const values: unknown[] = [];
    const where: string[] = [];
    if (rawStatus === "OPEN") where.push("UPPER(status) IN ('PENDING','IN_REVIEW')");
    else if (rawStatus !== "ALL") {
      values.push(rawStatus);
      where.push(`UPPER(status) = $${values.length}`);
    }
    if (search) {
      values.push(`%${search}%`);
      where.push(`concat_ws(' ', id::text, college_name, locality, guest_id, email, status, external_institution_id) ILIKE $${values.length}`);
    }
    values.push(500);
    const result = await pool.query(
      `SELECT id, college_name, locality, guest_id, email, external_institution_id,
              source, status, created_at, reviewed_at, reviewed_by_super_admin_id
       FROM public.guest_institution_requests
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY created_at DESC
       LIMIT $${values.length}`,
      values
    );
    return res.status(200).json({ success: true, requests: result.rows, count: result.rows.length });
  } catch (error) {
    console.error("Failed to load institution addition requests:", error);
    return res.status(500).json({ success: false, message: "Could not load institution requests. Confirm the guest institution request migration is applied." });
  }
}

export async function updateInstitutionAdditionRequest(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  const requestId = String(req.params.requestId || "").trim();
  const status = typeof req.body?.status === "string" ? req.body.status.trim().toUpperCase() : "";
  const allowed = new Set(["PENDING", "IN_REVIEW", "RESOLVED", "REJECTED"]);
  if (!requestId) return res.status(400).json({ success: false, message: "Request ID is required." });
  if (!allowed.has(status)) return res.status(400).json({ success: false, message: "Choose Pending, In review, Resolved, or Rejected." });
  try {
    const result = await pool.query(
      `UPDATE public.guest_institution_requests
       SET status = $2,
           reviewed_at = CASE WHEN $2 IN ('RESOLVED','REJECTED') THEN NOW() ELSE reviewed_at END,
           reviewed_by_super_admin_id = CASE WHEN $2 IN ('RESOLVED','REJECTED') THEN $3::uuid ELSE reviewed_by_super_admin_id END
       WHERE id::text = $1
       RETURNING id, college_name, locality, guest_id, email, external_institution_id, source, status, created_at, reviewed_at, reviewed_by_super_admin_id`,
      [requestId, status, req.superAdmin?.superAdminId]
    );
    if (!result.rowCount) return res.status(404).json({ success: false, message: "Institution request not found." });
    return res.status(200).json({ success: true, message: "Institution request status updated.", request: result.rows[0] });
  } catch (error) {
    console.error("Failed to update institution request:", error);
    return res.status(500).json({ success: false, message: "Could not update this institution request." });
  }
}
