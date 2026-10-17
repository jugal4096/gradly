import {
    Request,
    Response,
  } from "express";
  
  import {
    getStudentDetails,
    getStudents,
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