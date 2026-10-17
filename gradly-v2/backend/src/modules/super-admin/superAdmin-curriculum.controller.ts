import type { Response } from "express";
import { pool } from "../../config/database";
import type { SuperAdminAuthenticatedRequest } from "../../middleware/super-admin-auth.middleware";

type RawRecord = Record<string, unknown>;

function pick(records: RawRecord[], keys: string[]): unknown {
  for (const record of records) {
    const normalized = new Map(Object.entries(record || {}).map(([key, value]) => [key.toLowerCase(), value]));
    for (const key of keys) {
      const value = normalized.get(key.toLowerCase());
      if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
  }
  return null;
}

function normalizeRecord(row: Record<string, RawRecord>) {
  const records = [
    row.courseSubject || {},
    row.subject || {},
    row.semester || {},
    row.curriculum || {},
    row.branch || {},
    row.scheme || {},
    row.program || {},
    row.institution || {},
    row.academicYear || {},
    row.gradingSystem || {},
  ];
  const active = pick([row.courseSubject || {}], ["active"]);
  const mandatory = pick([row.courseSubject || {}], ["mandatory"]);
  const status = pick([row.curriculum || {}], ["status"]);
  return {
    id: pick([row.courseSubject || {}], ["id"]),
    code: pick([row.courseSubject || {}], ["course_code", "code", "subject_code"]),
    name: pick([row.courseSubject || {}], ["course_name", "name", "subject_name"]) ?? pick([row.subject || {}], ["name", "subject_name", "title"]),
    branch: pick([row.branch || {}], ["name", "branch_name", "department_name"]),
    branchCode: pick([row.branch || {}], ["code"]),
    semester: pick([row.semester || {}], ["semester_number", "name", "semester_no"]),
    semesterName: pick([row.semester || {}], ["name"]),
    credits: pick([row.courseSubject || {}], ["credits", "credit"]),
    scheme: pick([row.scheme || {}], ["name", "code", "regulations"]),
    academicYear: pick([row.academicYear || {}], ["name", "label", "year", "academic_year", "code", "title"]),
    program: pick([row.program || {}], ["name", "short_name", "level"]),
    admissionMode: null,
    courseType: pick([row.courseSubject || {}], ["course_type"]),
    mandatory,
    electiveGroup: pick([row.courseSubject || {}], ["elective_group"]),
    gradingRule: pick([row.gradingSystem || {}], ["name", "code", "label", "grading_system", "system_name"]),
    status,
    active,
    institution: pick([row.institution || {}], ["name", "short_name"]),
    curriculumVersion: pick([row.curriculum || {}], ["version"]),
    curriculumId: pick([row.curriculum || {}], ["id"]),
    totalSemesters: pick([row.curriculum || {}], ["total_semesters"]),
    curriculumCredits: pick([row.curriculum || {}], ["total_credits"]),
    expectedSemesterCredits: pick([row.semester || {}], ["expected_credits"]),
    // Keep no raw database records in the API response.
    rawFieldsAvailable: records.reduce((count, record) => count + Object.keys(record).length, 0),
  };
}

export async function listCurriculum(
  _req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  try {
    const result = await pool.query(
      `SELECT
         to_jsonb(cs) AS "courseSubject",
         to_jsonb(sub) AS subject,
         to_jsonb(sem) AS semester,
         to_jsonb(c) AS curriculum,
         to_jsonb(b) AS branch,
         to_jsonb(sc) AS scheme,
         to_jsonb(p) AS program,
         to_jsonb(i) AS institution,
         to_jsonb(ay) AS "academicYear",
         to_jsonb(gs) AS "gradingSystem"
       FROM public.curriculum_subjects cs
       JOIN public.curricula c ON c.id = cs.curriculum_id
       JOIN public.semesters sem ON sem.id = cs.semester_id
       LEFT JOIN public.subjects sub ON sub.id = cs.subject_id
       LEFT JOIN public.branches b ON b.id = c.branch_id
       LEFT JOIN public.schemes sc ON sc.id = c.scheme_id
       LEFT JOIN public.programs p ON p.id = c.program_id
       LEFT JOIN public.institutions i ON i.id = c.institution_id
       LEFT JOIN public.academic_years ay ON ay.id = c.academic_year_id
       LEFT JOIN public.grading_systems gs ON gs.id = c.grading_system_id
       ORDER BY i.name, p.name, b.name, sc.name, sem.semester_number, cs.course_code
       LIMIT 5000`
    );
    const curriculum = result.rows.map((row: Record<string, RawRecord>) => normalizeRecord(row));
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
