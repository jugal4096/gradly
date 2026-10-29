import {
    Request,
    Response,
  } from "express";
  
  import {
    getStudentDetails,
    getStudents,
    setStudentActive,
    getStudentActivity,
    findGuestSessions,
  } from "./user-management.service";
  
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
