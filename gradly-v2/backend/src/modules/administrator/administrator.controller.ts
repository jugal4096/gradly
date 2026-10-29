import { Request, Response } from "express";

import {
  listAdministrators,
  getAdministrator,
  changeAdministratorStatus,
  changeAdministratorDepartment,
  extendAdministratorShip,
  changeAdministratorGraduationDate,
} from "./administrator.service";

import {
  SuperAdminAuthenticatedRequest,
} from "../../middleware/super-admin-auth.middleware";

/* =========================================================
   LIST
   ========================================================= */

export async function getAdministrators(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  try {
    const {
      institutionId,
      branchId,
      status,
      registrationStatus,
      search,
      limit,
      offset,
    } = req.query;

    const result =
      await listAdministrators({
        institutionId:
          typeof institutionId === "string"
            ? institutionId
            : undefined,

        branchId:
          typeof branchId === "string"
            ? branchId
            : undefined,

        status:
          typeof status === "string"
            ? status
            : undefined,

        registrationStatus:
          typeof registrationStatus === "string"
            ? registrationStatus
            : undefined,

        search:
          typeof search === "string"
            ? search
            : undefined,

        limit:
          typeof limit === "string" && /^\d+$/.test(limit)
            ? Number(limit)
            : undefined,

        offset:
          typeof offset === "string" && /^\d+$/.test(offset)
            ? Number(offset)
            : undefined,
      });

    return res.status(200).json({
      administrators: result.administrators,
      count: result.administrators.length,
      total: result.total,
      page: {
        limit: result.limit,
        offset: result.offset,
        hasMore: result.offset + result.administrators.length < result.total,
      },
    });
  } catch (error) {
    console.error(
      "Failed to fetch administrators:",
      error
    );

    return res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch administrators.",
    });
  }
}

/* =========================================================
   DETAILS
   ========================================================= */

export async function getAdministratorDetails(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  try {
    const adminId =
      req.params.adminId;

    if (!adminId) {
      return res.status(400).json({
        message:
          "Administrator ID is required.",
      });
    }

    const administrator =
      await getAdministrator(
        adminId
      );

    return res.status(200).json({
      administrator,
    });
  } catch (error) {
    console.error(
      "Failed to fetch administrator:",
      error
    );

    return res.status(404).json({
      message:
        error instanceof Error
          ? error.message
          : "Administrator was not found.",
    });
  }
}

/* =========================================================
   STATUS
   ========================================================= */

export async function updateAdministratorStatus(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  try {
    const adminId =
      req.params.adminId;

    const {
      status,
    } = req.body;

    if (!adminId) {
      return res.status(400).json({
        message:
          "Administrator ID is required.",
      });
    }

    if (
      status !== "ACTIVE" &&
      status !== "SUSPENDED" &&
      status !== "DISABLED"
    ) {
      return res.status(400).json({
        message:
          "Status must be ACTIVE, SUSPENDED, or DISABLED.",
      });
    }

    if (!req.superAdmin?.superAdminId) {
      return res.status(401).json({
        message:
          "Super Admin authentication required.",
      });
    }

    const administrator =
      await changeAdministratorStatus(
        adminId,
        status,
        req.superAdmin.superAdminId,
        req.ip
      );

    return res.status(200).json({
      message:
        "Administrator status updated successfully.",
      administrator,
    });
  } catch (error) {
    console.error(
      "Failed to update administrator status:",
      error
    );

    return res.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Failed to update administrator status.",
    });
  }
}

/* =========================================================
   DEPARTMENT
   ========================================================= */

export async function updateAdministratorDepartment(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  try {
    const adminId =
      req.params.adminId;

    const {
      branchId,
    } = req.body;

    if (!adminId) {
      return res.status(400).json({
        message:
          "Administrator ID is required.",
      });
    }

    if (
      typeof branchId !== "string" ||
      !branchId.trim()
    ) {
      return res.status(400).json({
        message:
          "Branch ID is required.",
      });
    }

    if (!req.superAdmin?.superAdminId) {
      return res.status(401).json({
        message:
          "Super Admin authentication required.",
      });
    }

    const administrator =
      await changeAdministratorDepartment(
        adminId,
        branchId.trim(),
        req.superAdmin.superAdminId,
        req.ip
      );

    return res.status(200).json({
      message:
        "Administrator department updated successfully.",
      administrator,
    });
  } catch (error) {
    console.error(
      "Failed to change administrator department:",
      error
    );

    return res.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Failed to change administrator department.",
    });
  }
}

/* =========================================================
   EXTEND ADMINSHIP
   ========================================================= */

export async function extendAdminship(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  try {
    const adminId =
      req.params.adminId;

    const {
      expiresAt,
    } = req.body;

    if (!adminId) {
      return res.status(400).json({
        message:
          "Administrator ID is required.",
      });
    }

    if (
      typeof expiresAt !== "string" ||
      !expiresAt.trim()
    ) {
      return res.status(400).json({
        message:
          "New expiry date is required.",
      });
    }

    if (!req.superAdmin?.superAdminId) {
      return res.status(401).json({
        message:
          "Super Admin authentication required.",
      });
    }

    const administrator =
      await extendAdministratorShip(
        adminId,
        expiresAt.trim(),
        req.superAdmin.superAdminId,
        req.ip
      );

    return res.status(200).json({
      message:
        "Administratorship extended successfully.",
      administrator,
    });
  } catch (error) {
    console.error(
      "Failed to extend adminship:",
      error
    );

    return res.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Failed to extend adminship.",
    });
  }
}

/* =========================================================
   GRADUATION DATE
   ========================================================= */

export async function updateGraduationDate(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  try {
    const adminId =
      req.params.adminId;

    const {
      graduationDate,
    } = req.body;

    if (!adminId) {
      return res.status(400).json({
        message:
          "Administrator ID is required.",
      });
    }

    if (
      typeof graduationDate !== "string" ||
      !graduationDate.trim()
    ) {
      return res.status(400).json({
        message:
          "Graduation date is required.",
      });
    }

    if (!req.superAdmin?.superAdminId) {
      return res.status(401).json({
        message:
          "Super Admin authentication required.",
      });
    }

    const administrator =
      await changeAdministratorGraduationDate(
        adminId,
        graduationDate.trim(),
        req.superAdmin.superAdminId,
        req.ip
      );

    return res.status(200).json({
      message:
        "Graduation date updated successfully.",
      administrator,
    });
  } catch (error) {
    console.error(
      "Failed to update graduation date:",
      error
    );

    return res.status(400).json({
      message:
        error instanceof Error
          ? error.message
          : "Failed to update graduation date.",
    });
  }
}