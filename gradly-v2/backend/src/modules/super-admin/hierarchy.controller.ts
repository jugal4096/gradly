import type { Response } from "express";
import { pool } from "../../config/database";
import type { SuperAdminAuthenticatedRequest } from "../../middleware/super-admin-auth.middleware";

type BranchNode = { id: string; name: string };
type ProgramNode = { id: string; name: string; branches: BranchNode[] };
type InstitutionNode = { id: string; name: string; programs: ProgramNode[] };

export async function getSuperAdminAcademicHierarchy(
  _req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  try {
    const result = await pool.query(`
      SELECT
        i.id AS institution_id,
        i.name AS institution_name,
        p.id AS program_id,
        p.name AS program_name,
        b.id AS branch_id,
        b.name AS branch_name
      FROM institutions i
      LEFT JOIN programs p ON p.institution_id = i.id
      LEFT JOIN branches b ON b.program_id = p.id
      ORDER BY i.name ASC, p.name ASC, b.name ASC
    `);

    const institutions = new Map<string, InstitutionNode>();
    const programs = new Map<string, ProgramNode>();

    for (const row of result.rows) {
      if (!institutions.has(row.institution_id)) {
        institutions.set(row.institution_id, {
          id: row.institution_id,
          name: row.institution_name,
          programs: [],
        });
      }

      if (row.program_id && !programs.has(row.program_id)) {
        const program: ProgramNode = {
          id: row.program_id,
          name: row.program_name,
          branches: [],
        };
        programs.set(row.program_id, program);
        institutions.get(row.institution_id)!.programs.push(program);
      }

      if (row.branch_id && row.program_id) {
        programs.get(row.program_id)?.branches.push({
          id: row.branch_id,
          name: row.branch_name,
        });
      }
    }

    const data = Array.from(institutions.values()).map((institution) => ({
      ...institution,
      programCount: institution.programs.length,
      branchCount: institution.programs.reduce((sum, program) => sum + program.branches.length, 0),
    }));

    return res.status(200).json({ success: true, data });
  } catch {
    return res.status(500).json({
      success: false,
      message: "Academic hierarchy is temporarily unavailable.",
    });
  }
}
