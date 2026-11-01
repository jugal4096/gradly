import type { Response } from "express";
import { pool } from "../../config/database";
import type { SuperAdminAuthenticatedRequest } from "../../middleware/super-admin-auth.middleware";

export async function listFeedbackRequests(req: SuperAdminAuthenticatedRequest, res: Response) {
  if (!req.superAdmin?.superAdminId) return res.status(401).json({ message: "Super Admin authentication required." });
  try {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const status = typeof req.query.status === "string" ? req.query.status.trim().toUpperCase() : "ALL";
    const values: unknown[] = [];
    const where: string[] = [];
    const add = (value: unknown) => { values.push(value); return `$${values.length}`; };
    if (search) {
      const p = add(`%${search}%`);
      where.push(`to_jsonb(fr)::text ILIKE ${p}`);
    }
    if (status === "OPEN") {
      where.push(`LOWER(COALESCE(to_jsonb(fr)->>'status','')) NOT IN ('resolved','closed','rejected','completed','cancelled') AND COALESCE(to_jsonb(fr)->>'status','') <> ''`);
    } else if (status !== "ALL") {
      where.push(`UPPER(REPLACE(COALESCE(to_jsonb(fr)->>'status',''),' ','_')) = ${add(status)}`);
    }
    const limit = add(200);
    const result = await pool.query(
      `SELECT to_jsonb(fr) AS record
       FROM public.feedback_requests fr
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY COALESCE(to_jsonb(fr)->>'created_at', to_jsonb(fr)->>'submitted_at', to_jsonb(fr)->>'createdAt') DESC NULLS LAST
       LIMIT ${limit}`,
      values
    );
    const institutionValues: unknown[] = [];
    const institutionWhere: string[] = [];
    const addInstitutionValue = (value: unknown) => { institutionValues.push(value); return "$" + institutionValues.length; };
    if (search) {
      const p = addInstitutionValue(`%${search}%`);
      institutionWhere.push(`concat_ws(' ', id::text, college_name, locality, guest_id, status) ILIKE ${p}`);
    }
    if (status === "OPEN") {
      institutionWhere.push("status IN ('PENDING','IN_REVIEW')");
    } else if (status !== "ALL") {
      institutionWhere.push(`status = ${addInstitutionValue(status)}`);
    }
    const institutionLimit = addInstitutionValue(200);
    const institutionResult = await pool.query(
      `SELECT id, college_name AS subject, college_name AS title,
              'Institution addition request' AS category, 'INSTITUTION_REQUEST' AS type,
              concat('College: ', college_name, E'\\nLocality / City: ', locality,
                E'\\nGuest ID: ', COALESCE(guest_id, 'Not provided'),
                E'\\nExternal directory ID: ', COALESCE(external_institution_id, 'Not provided')) AS message,
              status, created_at, created_at AS updated_at,
              guest_id AS name, NULL::text AS email,
              jsonb_build_object('locality', locality, 'externalInstitutionId', external_institution_id,
                'source', source) AS metadata
       FROM public.guest_institution_requests
       ${institutionWhere.length ? "WHERE " + institutionWhere.join(" AND ") : ""}
       ORDER BY created_at DESC
       LIMIT ${institutionLimit}`,
      institutionValues
    );
    const feedback = [
      ...result.rows.map((row) => row.record as Record<string, unknown>),
      ...institutionResult.rows as Record<string, unknown>[],
    ].sort((a, b) => {
      const at = new Date(String(a.created_at ?? a.submitted_at ?? 0)).getTime() || 0;
      const bt = new Date(String(b.created_at ?? b.submitted_at ?? 0)).getTime() || 0;
      return bt - at;
    });
    return res.status(200).json({ success: true, feedback, count: feedback.length });
  } catch (error) {
    console.error("Failed to load feedback requests:", error);
    return res.status(500).json({ message: "Failed to load feedback requests." });
  }
}
