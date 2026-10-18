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
    const feedback = result.rows.map((row) => row.record as Record<string, unknown>);
    return res.status(200).json({ success: true, feedback, count: feedback.length });
  } catch (error) {
    console.error("Failed to load feedback requests:", error);
    return res.status(500).json({ message: "Failed to load feedback requests." });
  }
}
