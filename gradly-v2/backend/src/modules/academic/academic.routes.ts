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


/** Public curriculum selector used by student onboarding. */
router.get("/curricula", async (req: Request, res: Response): Promise<void> => {
  try {
    const institutionId = typeof req.query.institutionId === "string" ? req.query.institutionId : null;
    const branchId = typeof req.query.branchId === "string" ? req.query.branchId : null;
    const result = await pool.query(
      `SELECT
         c.id,
         c.institution_id,
         c.program_id,
         c.branch_id,
         c.scheme_id,
         i.name AS institution_name,
         p.name AS program_name,
         b.name AS branch_name,
         sc.name AS scheme_name,
         COALESCE(NULLIF(to_jsonb(c)->>'version', ''), NULLIF(to_jsonb(c)->>'name', ''), sc.name, 'Curriculum') AS version_label,
         (SELECT COUNT(*)::int FROM public.semesters sem WHERE sem.curriculum_id = c.id) AS semester_count
       FROM public.curricula c
       LEFT JOIN public.institutions i ON i.id = c.institution_id
       LEFT JOIN public.programs p ON p.id = c.program_id
       LEFT JOIN public.branches b ON b.id = c.branch_id
       LEFT JOIN public.schemes sc ON sc.id = c.scheme_id
       WHERE ($1::uuid IS NULL OR c.institution_id = $1::uuid)
         AND ($2::uuid IS NULL OR c.branch_id = $2::uuid)
       ORDER BY i.name, p.name, b.name, sc.name
       LIMIT 1000`,
      [institutionId, branchId]
    );
    res.status(200).json({ success: true, curricula: result.rows });
  } catch (error) {
    console.error("GET /api/academic/curricula error:", error);
    res.status(500).json({ success: false, message: "Failed to load curriculum options." });
  }
});

export default router;