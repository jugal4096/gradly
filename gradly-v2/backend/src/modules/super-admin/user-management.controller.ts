import {
    Request,
    Response,
  } from "express";
  
  import {
    getStudentDetails,
    getStudents,
    setStudentActive,
    getStudentActivity,
  } from "./user-management.service";
  import { findGuestSessions } from "./user-management.repository";
import { pool } from "../../config/database";
  
  import {
    SuperAdminAuthenticatedRequest,
  } from "../../middleware/super-admin-auth.middleware";
  
  
  export async function listStudents(
    req: SuperAdminAuthenticatedRequest,
    res: Response
  ) {
    try {
      if (!req.superAdmin) {
        return res.status(401).json({
          message:
            "Super Admin authentication required.",
        });
      }
  
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const institution = typeof req.query.institution === "string" ? req.query.institution : undefined;
      const program = typeof req.query.program === "string" ? req.query.program : undefined;
      const branch = typeof req.query.branch === "string" ? req.query.branch : undefined;
      const active = req.query.active === "true" ? true : req.query.active === "false" ? false : undefined;
      const students = await getStudents({ search, institution, program, branch, active });
  
      return res.status(200).json({
        students,
        count: students.length,
      });
  
    } catch (error) {
      console.error(
        "Failed to load students:",
        error
      );
  
      return res.status(500).json({
        message:
          "Failed to load student records.",
      });
    }
  }
  
  
  export async function getStudent(
    req: SuperAdminAuthenticatedRequest,
    res: Response
  ) {
    try {
      if (!req.superAdmin) {
        return res.status(401).json({
          message:
            "Super Admin authentication required.",
        });
      }
  
      const { userId } = req.params;
  
      if (!userId) {
        return res.status(400).json({
          message:
            "Student user ID is required.",
        });
      }
  
      const result =
        await getStudentDetails(
          userId,
          {
            superAdminId:
              req.superAdmin.superAdminId,
  
            ipAddress:
              req.ip ||
              req.socket.remoteAddress ||
              null,
          }
        );
  
      return res.status(200).json(
        result
      );
  
    } catch (error) {
      console.error(
        "Failed to load student details:",
        error
      );
  
      if (
        error instanceof Error &&
        error.message ===
          "Student account was not found."
      ) {
        return res.status(404).json({
          message: error.message,
        });
      }
  
      return res.status(500).json({
        message:
          "Failed to load student details.",
      });
    }
  }

export async function updateStudentStatus(req: SuperAdminAuthenticatedRequest, res: Response) {
  try {
    if (!req.superAdmin) return res.status(401).json({ message: "Super Admin authentication required." });
    if (typeof req.body?.active !== "boolean") return res.status(400).json({ message: "An active boolean is required." });
    const student = await setStudentActive(req.params.userId, req.body.active, {
      superAdminId: req.superAdmin.superAdminId,
      ipAddress: req.ip || req.socket.remoteAddress || null,
    });
    return res.status(200).json({ message: student.active ? "User reactivated." : "User disabled.", student });
  } catch (error) {
    if (error instanceof Error && error.message === "Student account was not found.") return res.status(404).json({ message: error.message });
    console.error("Failed to update student status:", error);
    return res.status(500).json({ message: "Failed to update user status." });
  }
}

export async function getStudentActivityLog(req: SuperAdminAuthenticatedRequest, res: Response) {
  try {
    if (!req.superAdmin) return res.status(401).json({ message: "Super Admin authentication required." });
    const activity = await getStudentActivity(req.params.userId);
    return res.status(200).json({ activity, count: activity.length });
  } catch (error) {
    console.error("Failed to load user activity:", error);
    return res.status(500).json({ message: "Failed to load user activity." });
  }
}


export async function listGuestSessions(req: SuperAdminAuthenticatedRequest, res: Response) {
  try {
    if (!req.superAdmin) return res.status(401).json({ message: "Super Admin authentication required." });
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const institution = typeof req.query.institution === "string" ? req.query.institution : undefined;
    const active = req.query.active === "true" ? true : req.query.active === "false" ? false : undefined;
    const guests = await findGuestSessions({ search, institution, active });
    return res.status(200).json({ guests, count: guests.length });
  } catch (error) {
    console.error("Failed to load guest sessions:", error);
    return res.status(500).json({ message: "Failed to load guest sessions." });
  }
}


/** Return the complete academic catalogue independently of registered users. */
export async function listAcademicOptions(req: SuperAdminAuthenticatedRequest, res: Response) {
  if (!req.superAdmin) return res.status(401).json({ message: "Super Admin authentication required." });
  try {
    const result = await pool.query(`
      SELECT
        i.id::text AS institution_id,
        i.name AS institution_name,
        p.id::text AS program_id,
        p.name AS program_name,
        b.id::text AS branch_id,
        b.name AS branch_name
      FROM public.institutions i
      LEFT JOIN public.programs p ON p.institution_id = i.id
      LEFT JOIN public.branches b ON b.program_id = p.id
      ORDER BY i.name ASC, p.name ASC NULLS FIRST, b.name ASC NULLS FIRST
    `);

    const institutions = new Map<string, {
      id: string;
      name: string;
      programs: Map<string, { id: string; name: string; branches: { id: string; name: string }[] }>;
    }>();

    for (const row of result.rows) {
      if (!institutions.has(row.institution_id)) {
        institutions.set(row.institution_id, { id: row.institution_id, name: row.institution_name, programs: new Map() });
      }
      if (!row.program_id) continue;
      const institution = institutions.get(row.institution_id)!;
      if (!institution.programs.has(row.program_id)) {
        institution.programs.set(row.program_id, { id: row.program_id, name: row.program_name, branches: [] });
      }
      if (row.branch_id) {
        institution.programs.get(row.program_id)!.branches.push({ id: row.branch_id, name: row.branch_name });
      }
    }

    const data = Array.from(institutions.values()).map((institution) => ({
      id: institution.id,
      name: institution.name,
      programs: Array.from(institution.programs.values()),
    }));
    return res.status(200).json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Failed to load academic filter options:", error);
    return res.status(503).json({ success: false, message: "Academic institution, program and branch options could not be loaded." });
  }
}
