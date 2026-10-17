import type { Response } from "express";
import { pool } from "../../config/database";
import type { SuperAdminAuthenticatedRequest } from "../../middleware/super-admin-auth.middleware";

const allowedFields = [
  "id", "code", "subject_code", "course_code", "name", "title",
  "subject_name", "course_name", "credits", "semester", "branch",
  "department", "scheme", "academic_year", "status", "created_at",
  "updated_at", "program", "program_name", "institution_id"
] as const;

function safeCurriculumRecord(raw: Record<string, unknown>) {
  const output: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) output[key] = raw[key];
  }
  return output;
}

export async function listCurriculum(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  try {
    const search = String(req.query.search || "").trim().slice(0, 120);
    const semester = String(req.query.semester || "").trim().slice(0, 20);
    const values: unknown[] = [];
    const where: string[] = [];
    if (search) {
      values.push(`%${search.replace(/[\\%_]/g, "\\$&")}%`);
      where.push(`to_jsonb(cs)::text ILIKE $1 ESCAPE '\\\\'`);
    }
    if (semester && semester !== "ALL") {
      values.push(semester);
      where.push(`COALESCE(to_jsonb(cs)->>'semester', '') = $${values.length}`);
    }
    const result = await pool.query(
      `SELECT to_jsonb(cs) AS record
       FROM public.curriculum_subjects cs
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY COALESCE(to_jsonb(cs)->>'semester', '') ASC,
                COALESCE(to_jsonb(cs)->>'subject_code', to_jsonb(cs)->>'course_code', to_jsonb(cs)->>'code', '') ASC
       LIMIT 500`,
      values
    );
    const curriculum = result.rows.map((row: { record: Record<string, unknown> }) => safeCurriculumRecord(row.record || {}));
    return res.status(200).json({ success: true, curriculum, count: curriculum.length });
  } catch (error) {
    console.error("Failed to list curriculum subjects:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load curriculum subjects from the configured database."
    });
  }
}
