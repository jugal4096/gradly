import type { Response } from "express";
import { pool } from "../../config/database";
import type { SuperAdminAuthenticatedRequest } from "../../middleware/super-admin-auth.middleware";

type RawRecord = Record<string, unknown>;
const aliases: Record<string, string[]> = {
  id: ["id", "subject_id", "course_id", "curriculum_subject_id"],
  code: ["subject_code", "course_code", "code", "course_id_code"],
  name: ["subject_name", "course_name", "name", "title", "subject", "course_title"],
  branch: ["branch", "branch_name", "department", "department_name", "specialization"],
  semester: ["semester", "semester_no", "semester_number", "sem", "term"],
  credits: ["credits", "credit", "total_credits", "course_credits"],
  scheme: ["scheme", "scheme_name", "curriculum_scheme", "regulation", "regulation_scheme"],
  academicYear: ["academic_year", "academicYear", "year", "curriculum_year"],
  program: ["program", "program_name", "degree", "degree_name", "course_program"],
  admissionMode: ["admission_mode", "admissionMode", "entry_mode"],
  courseType: ["course_type", "subject_type", "type", "category", "course_category"],
  gradingRule: ["grading_rule", "gradingRule", "evaluation_type", "assessment_type"],
  status: ["status", "publication_status", "is_active", "active"],
  institution: ["institution_name", "institution", "college_name"],
};

function pick(record: RawRecord, keys: string[]): unknown {
  const normalized = new Map(Object.entries(record).map(([key, value]) => [key.toLowerCase(), value]));
  for (const key of keys) {
    const value = normalized.get(key.toLowerCase());
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return null;
}

function normalizeRecord(record: RawRecord) {
  const output: Record<string, unknown> = {};
  for (const [field, keys] of Object.entries(aliases)) output[field] = pick(record, keys);
  // Keep only harmless, known academic metadata. Never expose arbitrary row fields.
  output.rawFieldsAvailable = Object.keys(record).filter((key) =>
    Object.values(aliases).some((keys) => keys.some((candidate) => candidate.toLowerCase() === key.toLowerCase()))
  ).length;
  return output;
}

export async function listCurriculum(
  _req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  try {
    // Read the source row as JSON so schema variations don't break the query.
    // The response is normalized to an explicit academic-field allowlist.
    const result = await pool.query(
      `SELECT to_jsonb(cs) AS record
       FROM public.curriculum_subjects cs
       ORDER BY COALESCE(
         to_jsonb(cs)->>'branch',
         to_jsonb(cs)->>'branch_name',
         to_jsonb(cs)->>'department',
         ''
       ) ASC,
       COALESCE(
         to_jsonb(cs)->>'semester',
         to_jsonb(cs)->>'semester_no',
         to_jsonb(cs)->>'sem',
         ''
       ) ASC
       LIMIT 5000`
    );
    const curriculum = result.rows.map((row: { record: RawRecord }) => normalizeRecord(row.record || {}));
    return res.status(200).json({
      success: true,
      curriculum,
      count: curriculum.length,
      limit: 5000,
    });
  } catch (error) {
    console.error("Failed to list curriculum subjects:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load curriculum subjects from the configured database."
    });
  }
}
