import type { Response } from "express";
import { pool } from "../../config/database";
import type { SuperAdminAuthenticatedRequest } from "../../middleware/super-admin-auth.middleware";

/**
 * Return the complete academic directory used by the Super Admin
 * Administrators filters. These are independent catalogue queries so
 * institutions/programs/branches remain available even when no admin is
 * currently assigned to them.
 */
export async function getAdministratorCatalog(
  _req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  try {
    const [institutionsResult, programsResult, branchesResult] =
      await Promise.all([
        pool.query(`
          SELECT id, name
          FROM institutions
          ORDER BY name ASC;
        `),
        pool.query(`
          SELECT id, name, institution_id
          FROM programs
          ORDER BY name ASC;
        `),
        pool.query(`
          SELECT
            b.id,
            b.name,
            b.program_id,
            p.name AS program_name,
            i.id AS institution_id,
            i.name AS institution_name
          FROM branches b
          INNER JOIN programs p
            ON p.id = b.program_id
          INNER JOIN institutions i
            ON i.id = p.institution_id
          ORDER BY
            i.name ASC,
            p.name ASC,
            b.name ASC;
        `)
      ]);

    return res.status(200).json({
      institutions: institutionsResult.rows,
      programs: programsResult.rows,
      branches: branchesResult.rows,
      counts: {
        institutions: institutionsResult.rowCount ?? institutionsResult.rows.length,
        programs: programsResult.rowCount ?? programsResult.rows.length,
        branches: branchesResult.rowCount ?? branchesResult.rows.length
      }
    });
  } catch (error) {
    console.error("Failed to fetch administrator catalogue:", error);
    return res.status(500).json({
      message: error instanceof Error
        ? error.message
        : "Failed to load the academic catalogue."
    });
  }
}
