import { createStudentNotification, deleteGuestSession, findAcademicFilters, findAllBranches, findDeletedStudents, findDisabledAccounts, findGuestActivity, findGuestSessions, findStudentActivity, softDeleteStudentAccount, updateStudentAccountStatus } from "./user-management.repository";
import { Response } from "express";
  
  import {
    getStudentDetails,
    getStudents,
  } from "./user-management.service";
  
  import {
    SuperAdminAuthenticatedRequest,
  } from "../../middleware/super-admin-auth.middleware";
  
  
  export async function listBranches(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.superAdmin) {
      return res.status(401).json({ message: "Super Admin authentication required." });
    }
    const branches = await findAllBranches();
    return res.status(200).json({ branches, count: branches.length });
  } catch (error) {
    console.error("Failed to load branches:", error);
    return res.status(500).json({ message: "Failed to load branches." });
  }
}


export async function getAcademicFilters(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.superAdmin) return res.status(401).json({ message: "Super Admin authentication required." });
    const filters = await findAcademicFilters();
    return res.status(200).json(filters);
  } catch (error) {
    console.error("Failed to load academic filter catalogue:", error);
    return res.status(500).json({ message: "Failed to load academic filter options." });
  }
}

export async function removeGuestSession(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.superAdmin?.superAdminId) return res.status(401).json({ message: "Super Admin authentication required." });
    const { guestId } = req.params;
    if (!guestId) return res.status(400).json({ message: "Guest session ID is required." });
    const deleted = await deleteGuestSession(guestId, req.superAdmin.superAdminId);
    if (!deleted) return res.status(404).json({ message: "Guest session was not found. It may already have been deleted." });
    return res.status(200).json({ message: "Guest session and its recorded guest activity were deleted." });
  } catch (error) {
    console.error("Failed to delete guest session:", error);
    return res.status(500).json({ message: "Failed to delete guest session." });
  }
}

export async function listDeletedStudents(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  if (!req.superAdmin) return res.status(401).json({ message: "Super Admin authentication required." });
  try {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const students = await findDeletedStudents(search);
    return res.status(200).json({ students, count: students.length });
  } catch (error) {
    console.error("Failed to load deleted student accounts:", error);
    return res.status(500).json({ message: "Failed to load deleted student records." });
  }
}

export async function listDisabledAccounts(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  if (!req.superAdmin) return res.status(401).json({ message: "Super Admin authentication required." });
  try {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const students = await findDisabledAccounts(search);
    return res.status(200).json({ students, count: students.length });
  } catch (error) {
    console.error("Failed to load disabled accounts:", error);
    return res.status(500).json({ message: "Failed to load disabled accounts." });
  }
}

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
  
      const search =
        typeof req.query.search === "string"
          ? req.query.search
          : undefined;
  
      const students =
        await getStudents(search);
  
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
  
  

  
  export async function listGuests(
    req: SuperAdminAuthenticatedRequest,
    res: Response
  ) {
    try {
      if (!req.superAdmin) {
        return res.status(401).json({
          message: "Super Admin authentication required.",
        });
      }

      const search =
        typeof req.query.search === "string"
          ? req.query.search
          : undefined;
      const guests = await findGuestSessions(search);

      return res.status(200).json({
        guests,
        count: guests.length,
        capped: guests.length === 500,
      });
    } catch (error) {
      console.error("Failed to load guest sessions:", error);
      return res.status(500).json({
        message: "Failed to load guest sessions.",
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

export async function listStudentActivity(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.superAdmin) {
      return res.status(401).json({ message: "Super Admin authentication required." });
    }
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ message: "Student user ID is required." });
    const events = await findStudentActivity(userId);
    return res.status(200).json({ events, count: events.length, capped: events.length === 200 });
  } catch (error) {
    console.error("Failed to load student activity:", error);
    return res.status(500).json({ message: "Failed to load student activity." });
  }
}


export async function listGuestActivity(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.superAdmin) return res.status(401).json({ message: "Super Admin authentication required." });
    const { guestId } = req.params;
    if (!guestId) return res.status(400).json({ message: "Guest session ID is required." });
    const events = await findGuestActivity(guestId);
    return res.status(200).json({ events, count: events.length, capped: events.length === 200 });
  } catch (error) {
    console.error("Failed to load guest activity:", error);
    return res.status(500).json({ message: "Failed to load guest activity." });
  }
}


export async function updateStudentStatus(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  const superAdminId = req.superAdmin?.superAdminId;
  if (!superAdminId) return res.status(401).json({ message: "Super Admin authentication required." });
  const { active } = req.body ?? {};
  if (typeof active !== "boolean") return res.status(400).json({ message: "active must be a boolean." });
  try {
    const updated = await updateStudentAccountStatus(
      req.params.userId,
      active,
      superAdminId,
      req.ip || req.socket.remoteAddress || null
    );
    if (!updated) return res.status(404).json({ message: "Student account was not found or has already been deleted." });
    return res.status(200).json({
      message: active ? "Account reactivated." : "Account disabled.",
      student: updated,
    });
  } catch (error) {
    console.error("Super Admin student status update failed:", error);
    return res.status(500).json({ message: "Unable to update student account status." });
  }
}

export async function deleteStudentAccount(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  const superAdminId = req.superAdmin?.superAdminId;
  if (!superAdminId) return res.status(401).json({ message: "Super Admin authentication required." });
  try {
    const deleted = await softDeleteStudentAccount(
      req.params.userId,
      superAdminId,
      req.ip || req.socket.remoteAddress || null
    );
    if (!deleted) return res.status(404).json({ message: "Student account was not found or has already been deleted." });
    return res.status(200).json({ message: "Student account soft-deleted. Academic records and audit history were preserved." });
  } catch (error) {
    console.error("Super Admin student deletion failed:", error);
    return res.status(500).json({ message: "Unable to delete student account." });
  }
}

export async function sendStudentNotification(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  const superAdminId = req.superAdmin?.superAdminId;
  if (!superAdminId) return res.status(401).json({ message: "Super Admin authentication required." });
  const { title, message, notificationType, actionUrl } = req.body ?? {};
  if (typeof title !== "string" || title.trim().length < 3 || title.trim().length > 160) {
    return res.status(400).json({ message: "Notification title must be 3–160 characters." });
  }
  if (typeof message !== "string" || message.trim().length < 5 || message.trim().length > 4000) {
    return res.status(400).json({ message: "Notification message must be 5–4,000 characters." });
  }
  const allowedTypes = new Set(["GENERAL", "IMPORTANT", "WARNING", "ACADEMIC"]);
  const type = typeof notificationType === "string" && allowedTypes.has(notificationType)
    ? notificationType
    : "GENERAL";
  if (actionUrl !== undefined && actionUrl !== null &&
      (typeof actionUrl !== "string" || !actionUrl.startsWith("/") || actionUrl.startsWith("//"))) {
    return res.status(400).json({ message: "actionUrl must be a safe Gradly-relative path." });
  }
  try {
    const notification = await createStudentNotification(
      req.params.userId,
      superAdminId,
      {
        title: title.trim(),
        message: message.trim(),
        notificationType: type,
        actionUrl: typeof actionUrl === "string" ? actionUrl.slice(0, 300) : null,
      },
      req.ip || req.socket.remoteAddress || null
    );
    if (!notification) return res.status(404).json({ message: "Active student account not found." });
    return res.status(201).json({ message: "Notification sent to student.", notification });
  } catch (error) {
    console.error("Super Admin student notification failed:", error);
    return res.status(500).json({ message: "Unable to send student notification." });
  }
}
