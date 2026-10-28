import { Response } from "express";

import {
  getStudentDetails,
  getStudents,
} from "./user-management.service";

import {
  SuperAdminAuthenticatedRequest,
} from "../../middleware/super-admin-auth.middleware";

function parsePositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function listStudents(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.superAdmin) {
      return res.status(401).json({
        message: "Super Admin authentication required.",
      });
    }

    const page = Math.min(parsePositiveInteger(req.query.page, 1), 1000000);
    const pageSize = Math.min(parsePositiveInteger(req.query.pageSize, 25), 100);
    const filters = {
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      institution: typeof req.query.institution === "string" ? req.query.institution : undefined,
      program: typeof req.query.program === "string" ? req.query.program : undefined,
      branch: typeof req.query.branch === "string" ? req.query.branch : undefined,
      page,
      pageSize,
    };

    const result = await getStudents(filters);

    return res.status(200).json({
      students: result.students,
      count: result.count,
      page,
      pageSize,
      totalPages: Math.ceil(result.count / pageSize),
    });
  } catch (error) {
    console.error("Failed to load students:", error);

    return res.status(500).json({
      message: "Failed to load student records.",
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
        message: "Super Admin authentication required.",
      });
    }

    const userId =
      typeof req.params.userId === "string" ? req.params.userId : "";

    if (!userId) {
      return res.status(400).json({
        message: "Student user ID is required.",
      });
    }

    const result = await getStudentDetails(userId, {
      superAdminId: req.superAdmin.superAdminId,
      ipAddress: req.ip || req.socket.remoteAddress || null,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Failed to load student details:", error);

    if (error instanceof Error && error.message === "Student account was not found.") {
      return res.status(404).json({
        message: "Student account was not found.",
      });
    }

    return res.status(500).json({
      message: "Failed to load student details.",
    });
  }
}
