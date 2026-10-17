
import type { Request, Response } from "express";

import {
  listApplications,
  listInstitutionBranches,
  saveApplicationConfiguration,
  reviewApplication as reviewApplicationInDb,
} from "./admin-application.repository";

interface SuperAdminRequest extends Request {
  superAdmin?: {
    superAdminId: string;
  };
}

type ReviewDecision = "ACCEPTED" | "REJECTED";
type ApplicationStatus = "PENDING" | "ACCEPTED" | "REJECTED";

interface ApplicationReviewError extends Error {
  statusCode?: number;
}

/**
 * Extract the authenticated Super Admin ID.
 */
function getSuperAdminId(req: Request): string | null {
  const id = (req as SuperAdminRequest).superAdmin?.superAdminId;

  if (typeof id !== "string" || !id.trim()) {
    return null;
  }

  return id.trim();
}

/**
 * Return a valid HTTP status code from a repository error.
 */
function getErrorStatus(error: unknown): number {
  if (error instanceof Error) {
    const statusCode = (error as ApplicationReviewError).statusCode;

    if (
      typeof statusCode === "number" &&
      Number.isInteger(statusCode) &&
      statusCode >= 400 &&
      statusCode <= 599
    ) {
      return statusCode;
    }
  }

  return 500;
}

/**
 * Validate UUIDs.
 */
function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.trim()
    )
  );
}

/**
 * Normalize permissions and remove duplicates.
 * The repository performs the final permission-code validation.
 */
function normalizePermissions(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const permissions: string[] = [];

  for (const permission of value) {
    if (
      typeof permission !== "string" ||
      permission.trim().length === 0
    ) {
      return null;
    }

    permissions.push(permission.trim());
  }

  return [...new Set(permissions)];
}

/**
 * Read the first string-valued field from a request body.
 */
function getStringField(
  body: unknown,
  keys: string[]
): string | undefined {
  if (body === null || typeof body !== "object") {
    return undefined;
  }

  const record = body as Record<string, unknown>;

  for (const key of keys) {
    if (typeof record[key] === "string") {
      return record[key] as string;
    }
  }

  return undefined;
}

/**
 * GET /api/super-admin/applications
 * GET /api/super-admin/applications?status=PENDING
 */
export async function getApplications(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    if (!getSuperAdminId(req)) {
      return res.status(401).json({
        success: false,
        message: "Super Admin authentication required.",
      });
    }

    const rawStatus = req.query.status;

    if (
      Array.isArray(rawStatus) ||
      (rawStatus !== undefined && typeof rawStatus !== "string")
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide exactly one valid application status.",
      });
    }

    let status: ApplicationStatus | undefined;

    if (rawStatus !== undefined) {
      if (
        rawStatus !== "PENDING" &&
        rawStatus !== "ACCEPTED" &&
        rawStatus !== "REJECTED"
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid application status.",
        });
      }

      status = rawStatus;
    }

    const applications = await listApplications(status);

    return res.status(200).json({
      success: true,
      applications,
    });
  } catch (error) {
    console.error(
      "Could not list administrator applications:",
      error
    );

    return res.status(getErrorStatus(error)).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not load administrator applications.",
    });
  }
}

/**
 * GET /api/super-admin/applications/institutions/:institutionId/branches
 */
export async function getInstitutionBranches(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    if (!getSuperAdminId(req)) {
      return res.status(401).json({
        success: false,
        message: "Super Admin authentication required.",
      });
    }

    const institutionId = req.params.institutionId?.trim();

    if (!isUuid(institutionId)) {
      return res.status(400).json({
        success: false,
        message: "A valid institution ID is required.",
      });
    }

    const branches = await listInstitutionBranches(institutionId);

    return res.status(200).json({
      success: true,
      branches,
    });
  } catch (error) {
    console.error("Could not load institution branches:", error);

    return res.status(getErrorStatus(error)).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not load institution branches.",
    });
  }
}

/**
 * PATCH /api/super-admin/applications/:applicationId/configuration
 *
 * Saves the department and approved permissions without accepting
 * the application. The repository keeps the status as PENDING.
 */
export async function saveApplicationConfigurationController(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    const superAdminId = getSuperAdminId(req);

    if (!superAdminId) {
      return res.status(401).json({
        success: false,
        message: "Super Admin authentication required.",
      });
    }

    const applicationId = req.params.applicationId?.trim();

    if (!isUuid(applicationId)) {
      return res.status(400).json({
        success: false,
        message: "A valid application ID is required.",
      });
    }

    const branchId = getStringField(req.body, [
      "branchId",
      "branch_id",
      "departmentId",
    ])?.trim();

    if (!isUuid(branchId)) {
      return res.status(400).json({
        success: false,
        message: "Select a valid department.",
      });
    }

    const rawPermissions =
      req.body?.approvedPermissions ??
      req.body?.approved_permissions ??
      req.body?.permissions;

    const approvedPermissions =
      normalizePermissions(rawPermissions);

    if (
      approvedPermissions === null ||
      approvedPermissions.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Select at least one valid permission.",
      });
    }

    const application = await saveApplicationConfiguration({
      applicationId,
      superAdminId,
      branchId,
      approvedPermissions,
    });

    return res.status(200).json({
      success: true,
      message: "Application configuration saved successfully.",
      application,
    });
  } catch (error) {
    console.error(
      "Could not save administrator application configuration:",
      error
    );

    return res.status(getErrorStatus(error)).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not save application configuration.",
    });
  }
}

/**
 * PATCH /api/super-admin/applications/:applicationId/review
 *
 * Accept payload:
 * {
 *   "decision": "ACCEPTED",
 *   "branchId": "<branch UUID>",
 *   "permissions": ["VIEW_STUDENTS"]
 * }
 *
 * Reject payload:
 * {
 *   "decision": "REJECTED",
 *   "rejection_reason": "Reason for rejection"
 * }
 */
export async function reviewApplication(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    const superAdminId = getSuperAdminId(req);

    if (!superAdminId) {
      return res.status(401).json({
        success: false,
        message: "Super Admin authentication required.",
      });
    }

    const applicationId = req.params.applicationId?.trim();

    if (!isUuid(applicationId)) {
      return res.status(400).json({
        success: false,
        message: "A valid application ID is required.",
      });
    }

    const rawDecision: unknown = req.body?.decision;

    if (
      rawDecision !== "ACCEPTED" &&
      rawDecision !== "REJECTED"
    ) {
      return res.status(400).json({
        success: false,
        message: "Decision must be ACCEPTED or REJECTED.",
      });
    }

    const decision: ReviewDecision = rawDecision;

    const rejectionReason =
      getStringField(req.body, [
        "rejection_reason",
        "reviewComment",
      ])?.trim() ?? "";

    if (decision === "REJECTED" && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: "Provide a rejection reason.",
      });
    }

    let branchId: string | undefined;
    let permissions: string[] = [];

    if (decision === "ACCEPTED") {
      branchId = getStringField(req.body, [
        "branchId",
        "branch_id",
        "departmentId",
      ])?.trim();

      if (!isUuid(branchId)) {
        return res.status(400).json({
          success: false,
          message:
            "A valid department ID is required. Select a department and try again.",
        });
      }

      const rawPermissions =
        req.body?.permissions ??
        req.body?.approvedPermissions ??
        req.body?.approved_permissions;

      const normalizedPermissions =
        normalizePermissions(rawPermissions);

      if (
        normalizedPermissions === null ||
        normalizedPermissions.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Select at least one valid permission before accepting.",
        });
      }

      permissions = normalizedPermissions;
    }

    const application = await reviewApplicationInDb({
      applicationId,
      superAdminId,
      decision,
      rejectionReason:
        decision === "REJECTED"
          ? rejectionReason
          : undefined,
      branchId,
      permissions,
    });

    return res.status(200).json({
      success: true,
      message:
        decision === "ACCEPTED"
          ? "Application accepted with the approved department and permissions."
          : "Application rejected.",
      application,
    });
  } catch (error) {
    console.error(
      "Administrator application review failed:",
      error
    );

    return res.status(getErrorStatus(error)).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not review the administrator application.",
    });
  }
}
