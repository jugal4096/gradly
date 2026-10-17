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
          b.name AS branch_name
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

export default router;