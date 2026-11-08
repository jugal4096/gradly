import { Router, Request, Response } from "express";
import { pool } from "../../config/database";

const router = Router();

/**
 * GET /api/academic/institutions
 *
 * Public academic master-data endpoint.
 *
 * This endpoint only returns institution/branch information.
 * No student or private information is exposed here.
 *
 * Authentication is intentionally NOT required because this
 * data is needed to populate institution selectors before an
 * authenticated application is submitted.
 */
router.get("/institutions/search", async (req: Request, res: Response): Promise<void> => {
  const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  if (query.length < 2) { res.status(200).json({ success: true, data: [] }); return; }
  try {
    const result = await pool.query(
      `SELECT i.id AS institution_id, i.name AS institution_name,
              b.id AS branch_id, b.name AS branch_name, b.code AS branch_code,
              p.id AS program_id, p.name AS program_name, p.level AS program_level
       FROM institutions i
       LEFT JOIN programs p ON p.institution_id = i.id
       LEFT JOIN branches b ON b.program_id = p.id
       WHERE i.name ILIKE $1
       ORDER BY i.name, p.name, b.name
       LIMIT 120`,
      [`%${query}%`],
    );
    const map = new Map<string, { id: string; name: string; branches: Array<{ id: string; name: string; code: string | null; program_id: string; program_name: string; program_level: string | null }> }>();
    for (const row of result.rows) {
      if (!map.has(row.institution_id)) map.set(row.institution_id, { id: row.institution_id, name: row.institution_name, branches: [] });
      if (row.branch_id) map.get(row.institution_id)!.branches.push({
        id: row.branch_id, name: row.branch_name, code: row.branch_code,
        program_id: row.program_id, program_name: row.program_name, program_level: row.program_level,
      });
    }
    res.status(200).json({ success: true, data: Array.from(map.values()) });
  } catch (error) {
    console.error("Institution search failed:", error);
    res.status(500).json({ success: false, message: "Unable to search institutions." });
  }
});

router.get(
  "/institutions",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await pool.query(`
        SELECT
          i.id AS institution_id,
          i.name AS institution_name,
          b.id AS branch_id,
          b.name AS branch_name,
          b.code AS branch_code,
          p.id AS program_id,
          p.name AS program_name,
          p.level AS program_level
        FROM institutions i
        INNER JOIN programs p
          ON p.institution_id = i.id
        INNER JOIN branches b
          ON b.program_id = p.id
        ORDER BY
          i.name ASC,
          b.name ASC;
      `);

      const institutionsMap = new Map<
        string,
        {
          id: string;
          name: string;
          branches: {
            id: string;
            name: string;
            code?: string | null;
            program_id: string;
            program_name: string;
            program_level?: string | null;
          }[];
        }
      >();

      for (const row of result.rows) {
        if (!institutionsMap.has(row.institution_id)) {
          institutionsMap.set(row.institution_id, {
            id: row.institution_id,
            name: row.institution_name,
            branches: [],
          });
        }

        institutionsMap
          .get(row.institution_id)!
          .branches.push({
            id: row.branch_id,
            name: row.branch_name,
            code: row.branch_code,
            program_id: row.program_id,
            program_name: row.program_name,
            program_level: row.program_level,
          });
      }

      const institutions = Array.from(
        institutionsMap.values()
      );

      res.status(200).json({
        success: true,
        data: institutions,
      });
    } catch (error) {
      console.error(
        "GET /api/academic/institutions error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "Failed to load academic master data.",
      });
    }
  }
);



/** Available curricula for a selected institution/program/branch. */
router.get("/curricula", async (req: Request, res: Response): Promise<void> => {
  const { institutionId, programId, branchId } = req.query;
  if (typeof institutionId !== "string" || typeof programId !== "string" || typeof branchId !== "string") {
    res.status(400).json({ success: false, message: "Institution, programme and branch are required." });
    return;
  }
  try {
    const result = await pool.query(
      `SELECT c.id, c.version, c.status, c.total_semesters, c.total_credits,
              c.scheme_id, sc.name AS scheme_name, sc.code AS scheme_code,
              COUNT(DISTINCT sem.id)::int AS configured_semesters
       FROM curricula c
       LEFT JOIN schemes sc ON sc.id = c.scheme_id
       LEFT JOIN curriculum_subjects cs ON cs.curriculum_id = c.id AND cs.active = TRUE
       LEFT JOIN semesters sem ON sem.id = cs.semester_id
       WHERE c.institution_id = $1 AND c.program_id = $2 AND c.branch_id = $3
       GROUP BY c.id, sc.name, sc.code
       ORDER BY c.version DESC NULLS LAST, sc.name ASC`,
      [institutionId, programId, branchId],
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("GET /api/academic/curricula error:", error);
    res.status(500).json({ success: false, message: "Failed to load curricula." });
  }
});

/** Available enrollment modes for a programme, including institution-specific overrides and global defaults. */
router.get("/admission-modes", async (req: Request, res: Response): Promise<void> => {
  const { institutionId, programmePrefix } = req.query;
  if (typeof institutionId !== "string" || typeof programmePrefix !== "string" || !/^(BE|BT|MC|MT)$/.test(programmePrefix)) {
    res.status(400).json({ success: false, message: "Institution and programme prefix are required." });
    return;
  }
  try {
    const result = await pool.query(
      `SELECT id, institution_id, programme_prefix, mode_code, mode_name, entry_semester
       FROM enrollment_admission_modes
       WHERE (institution_id = $1 OR institution_id IS NULL)
         AND (programme_prefix = $2 OR programme_prefix IS NULL)
       ORDER BY (institution_id = $1) DESC NULLS LAST,
                (programme_prefix = $2) DESC NULLS LAST,
                mode_code`,
      [institutionId, programmePrefix],
    );
    const preferred = result.rows[0];
    const rows = preferred ? result.rows.filter((row: any) =>
      (row.institution_id ?? null) === (preferred.institution_id ?? null) &&
      (row.programme_prefix ?? null) === (preferred.programme_prefix ?? null)
    ) : [];
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("GET /api/academic/admission-modes error:", error);
    res.status(500).json({ success: false, message: "Failed to load admission modes." });
  }
});

/** Curriculum subjects for a specific semester, used by the student manual-entry form. */
router.get("/curricula/:curriculumId/semesters/:semesterNumber/subjects", async (req: Request, res: Response): Promise<void> => {
  const { curriculumId, semesterNumber } = req.params;
  const number = Number(semesterNumber);
  if (!Number.isInteger(number) || number < 1 || number > 12) {
    res.status(400).json({ success: false, message: "Invalid semester number." });
    return;
  }
  try {
    const result = await pool.query(
      `SELECT cs.id, cs.course_code AS code, cs.course_name AS name,
              cs.credits, cs.course_type AS "courseType", cs.mandatory,
              sem.id AS "semesterId", sem.semester_number AS semester
       FROM curriculum_subjects cs
       JOIN semesters sem ON sem.id = cs.semester_id
       WHERE cs.curriculum_id = $1 AND sem.semester_number = $2
         AND cs.active = TRUE
       ORDER BY cs.course_code, cs.course_name`,
      [curriculumId, number],
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("GET curriculum subjects error:", error);
    res.status(500).json({ success: false, message: "Failed to load curriculum subjects." });
  }
});

export default router;