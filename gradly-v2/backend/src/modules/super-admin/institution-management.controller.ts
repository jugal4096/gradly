import type { Response } from "express";
import type { SuperAdminAuthenticatedRequest } from "../../middleware/super-admin-auth.middleware";
import { pool } from "../../config/database";

const text = (value: unknown, max = 180) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function listInstitutions(req: SuperAdminAuthenticatedRequest, res: Response) {
  if (!req.superAdmin) return res.status(401).json({ success: false, message: "Super Admin authentication required." });
  try {
    const search = text(req.query.search, 120);
    const result = await pool.query(`
      SELECT i.id, i.name,
        COUNT(DISTINCT a.id) FILTER (WHERE UPPER(COALESCE(a.status, '')) = 'ACTIVE')::int AS active_admins,
        COUNT(DISTINCT u.id) FILTER (WHERE u.active = TRUE)::int AS active_users,
        COUNT(DISTINCT c.id)::int AS curriculum_count,
        COUNT(DISTINCT p.id)::int AS program_count,
        COUNT(DISTINCT b.id)::int AS branch_count
      FROM public.institutions i
      LEFT JOIN public.programs p ON p.institution_id = i.id
      LEFT JOIN public.branches b ON b.program_id = p.id
      LEFT JOIN public.curricula c ON c.program_id = p.id
      LEFT JOIN public.admins a ON a.institution_id = i.id
      LEFT JOIN public.student_profiles sp ON sp.institution_id = i.id
      LEFT JOIN public.users u ON u.id = sp.user_id
      WHERE ($1 = '' OR i.name ILIKE '%' || $1 || '%')
      GROUP BY i.id, i.name ORDER BY i.name ASC LIMIT 300
    `, [search]);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Super Admin institution listing failed:", error);
    return res.status(503).json({ success: false, message: "Institution data could not be loaded. Check the database schema and backend logs." });
  }
}

export async function createInstitution(req: SuperAdminAuthenticatedRequest, res: Response) {
  if (!req.superAdmin) return res.status(401).json({ success: false, message: "Super Admin authentication required." });
  const name = text(req.body?.name, 180);
  if (name.length < 2) return res.status(400).json({ success: false, message: "Enter an institution name (at least 2 characters)." });
  try {
    const result = await pool.query(`INSERT INTO public.institutions (name) VALUES ($1) RETURNING id, name`, [name]);
    return res.status(201).json({ success: true, data: result.rows[0], message: "Institution created." });
  } catch (error) {
    console.error("Super Admin institution creation failed:", error);
    return res.status(409).json({ success: false, message: "Could not create this institution. It may already exist or the database schema may require additional fields." });
  }
}

export async function listInstitutionPrograms(req: SuperAdminAuthenticatedRequest, res: Response) {
  if (!req.superAdmin) return res.status(401).json({ success: false, message: "Super Admin authentication required." });
  const institutionId = text(req.params.institutionId, 100);
  try {
    const result = await pool.query(`
      SELECT p.id, p.name, p.institution_id, COUNT(DISTINCT b.id)::int AS branch_count,
        COALESCE(json_agg(json_build_object('id', b.id, 'name', b.name) ORDER BY b.name)
          FILTER (WHERE b.id IS NOT NULL), '[]'::json) AS branches
      FROM public.programs p
      LEFT JOIN public.branches b ON b.program_id = p.id
      WHERE p.institution_id = $1
      GROUP BY p.id, p.name, p.institution_id
      ORDER BY p.name
    `, [institutionId]);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Super Admin program listing failed:", error);
    return res.status(503).json({ success: false, message: "Programs could not be loaded." });
  }
}

export async function createInstitutionProgram(req: SuperAdminAuthenticatedRequest, res: Response) {
  if (!req.superAdmin) return res.status(401).json({ success: false, message: "Super Admin authentication required." });
  const institutionId = text(req.params.institutionId, 100);
  const name = text(req.body?.name, 180);
  if (!institutionId || name.length < 2) return res.status(400).json({ success: false, message: "Institution and program name are required." });
  try {
    const institution = await pool.query("SELECT id FROM public.institutions WHERE id = $1 LIMIT 1", [institutionId]);
    if (!institution.rowCount) return res.status(404).json({ success: false, message: "Institution not found." });
    const result = await pool.query("INSERT INTO public.programs (institution_id, name) VALUES ($1, $2) RETURNING id, institution_id, name", [institutionId, name]);
    return res.status(201).json({ success: true, data: result.rows[0], message: "Program created." });
  } catch (error) {
    console.error("Super Admin program creation failed:", error);
    return res.status(409).json({ success: false, message: "Could not create this program. Check the database constraints." });
  }
}

export async function createInstitutionBranch(req: SuperAdminAuthenticatedRequest, res: Response) {
  if (!req.superAdmin) return res.status(401).json({ success: false, message: "Super Admin authentication required." });
  const institutionId = text(req.params.institutionId, 100);
  const programId = text(req.params.programId, 100);
  const name = text(req.body?.name, 180);
  if (!institutionId || !programId || name.length < 2) return res.status(400).json({ success: false, message: "Institution, program and branch name are required." });
  try {
    const program = await pool.query("SELECT id FROM public.programs WHERE id = $1 AND institution_id = $2 LIMIT 1", [programId, institutionId]);
    if (!program.rowCount) return res.status(404).json({ success: false, message: "That program does not belong to the selected institution." });
    const result = await pool.query("INSERT INTO public.branches (program_id, name) VALUES ($1, $2) RETURNING id, program_id, name", [programId, name]);
    return res.status(201).json({ success: true, data: result.rows[0], message: "Branch created." });
  } catch (error) {
    console.error("Super Admin branch creation failed:", error);
    return res.status(409).json({ success: false, message: "Could not create this branch. Check the database constraints." });
  }
}
