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
    row.courseSubject || {}, row.subject || {}, row.semester || {},
    row.curriculum || {}, row.branch || {}, row.scheme || {}, row.program || {},
    row.institution || {}, row.academicYear || {}, row.gradingSystem || {},
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
    return res.status(200).json({ success: true, curriculum, count: curriculum.length, limit: 5000 });
  } catch (error) {
    console.error("Failed to list curriculum subjects:", error);
    return res.status(500).json({ success: false, message: "Failed to load curriculum subjects from the configured database." });
  }
}

/**
 * Updates only editable fields on the curriculum_subjects row. Column names are
 * discovered from PostgreSQL metadata so this endpoint does not assume optional
 * columns exist in every deployment. It never updates shared subjects records.
 */
export async function updateCurriculumSubject(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ success: false, message: "A curriculum subject ID is required." });

  const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
  const editable: Array<{ api: string; columns: string[]; type: "text" | "number" | "boolean" }> = [
    { api: "code", columns: ["course_code", "code", "subject_code"], type: "text" },
    { api: "name", columns: ["course_name"], type: "text" },
    { api: "credits", columns: ["credits", "credit"], type: "number" },
    { api: "courseType", columns: ["course_type"], type: "text" },
    { api: "mandatory", columns: ["mandatory"], type: "boolean" },
    { api: "active", columns: ["active"], type: "boolean" },
  ];
  const requested = editable.filter(field => Object.prototype.hasOwnProperty.call(body, field.api));
  if (!requested.length) return res.status(400).json({ success: false, message: "No editable curriculum fields were provided." });

  const client = await pool.connect();
  try {
    const metadata = await client.query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'curriculum_subjects'`
    );
    const actualColumns = new Set<string>(metadata.rows.map((row: { column_name: string }) => row.column_name));
    const updates: Array<{ column: string; value: unknown }> = [];

    for (const field of requested) {
      const column = field.columns.find(candidate => actualColumns.has(candidate));
      if (!column) {
        return res.status(400).json({ success: false, message: `This database does not expose an editable ${field.api} field on curriculum_subjects.` });
      }
      let value = body[field.api];
      if (field.type === "text") {
        if (typeof value !== "string" || !value.trim()) {
          return res.status(400).json({ success: false, message: `${field.api} must be a non-empty string.` });
        }
        value = value.trim();
      } else if (field.type === "number") {
        value = Number(value);
        if (!Number.isFinite(value) || Number(value) < 0) {
          return res.status(400).json({ success: false, message: "Credits must be a valid non-negative number." });
        }
      } else {
        if (typeof value !== "boolean") {
          if (value === "true" || value === 1 || value === "1") value = true;
          else if (value === "false" || value === 0 || value === "0") value = false;
          else return res.status(400).json({ success: false, message: `${field.api} must be true or false.` });
        }
      }
      updates.push({ column, value });
    }

    await client.query("BEGIN");
    const setSql = updates.map((item, index) => `"${item.column}" = $${index + 1}`).join(", ");
    const values = updates.map(item => item.value);
    values.push(id);
    const result = await client.query(
      `UPDATE public.curriculum_subjects SET ${setSql} WHERE id::text = $${values.length} RETURNING id`,
      values
    );
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Curriculum record was not found. Refresh the page and try again." });
    }
    await client.query("COMMIT");
    return res.status(200).json({ success: true, message: "Curriculum record updated in the database.", id: result.rows[0].id });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Failed to update curriculum subject:", error);
    return res.status(500).json({ success: false, message: "Could not update this curriculum record in the database." });
  } finally {
    client.release();
  }
}
