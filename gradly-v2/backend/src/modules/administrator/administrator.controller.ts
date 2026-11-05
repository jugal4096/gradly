import type { Response } from "express";
import { pool } from "../../config/database";

import {
  listAdministrators,
  getAdministrator,
  changeAdministratorStatus,
  changeAdministratorDepartment,
  extendAdministratorShip,
  changeAdministratorGraduationDate,
  deleteAdministrator,
  changeAdministratorPermissions,
  getAdministratorPermissions,
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
    } = req.query;

    const administrators =
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
      });

    return res.status(200).json({
      administrators,
      count: administrators.length,
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
    const adminId = typeof req.params.adminId === "string" ? req.params.adminId : "";

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
    const adminId = typeof req.params.adminId === "string" ? req.params.adminId : "";

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
    const adminId = typeof req.params.adminId === "string" ? req.params.adminId : "";

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
    const adminId = typeof req.params.adminId === "string" ? req.params.adminId : "";

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
    const adminId = typeof req.params.adminId === "string" ? req.params.adminId : "";

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

/* =========================================================
   ADMINISTRATOR PERMISSIONS
   ========================================================= */

export async function getAdminPermissions(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  try {
    const adminId = typeof req.params.adminId === "string" ? req.params.adminId : "";
    if (!adminId) return res.status(400).json({ message: "Administrator ID is required." });
    const permissions = await getAdministratorPermissions(adminId);
    return res.status(200).json({ permissions });
  } catch (error) {
    return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to load administrator permissions." });
  }
}

export async function updateAdminPermissions(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  try {
    const adminId = typeof req.params.adminId === "string" ? req.params.adminId : "";
    if (!adminId) return res.status(400).json({ message: "Administrator ID is required." });
    if (!req.superAdmin?.superAdminId) return res.status(401).json({ message: "Super Admin authentication required." });
    const permissions = req.body?.permissions;
    if (!Array.isArray(permissions) || permissions.some((item: unknown) => typeof item !== "string")) {
      return res.status(400).json({ message: "Permissions must be an array of permission codes." });
    }
    const updated = await changeAdministratorPermissions(
      adminId,
      permissions,
      req.superAdmin.superAdminId,
      req.ip
    );
    return res.status(200).json({ message: "Administrator permissions updated successfully.", permissions: updated });
  } catch (error) {
    return res.status(400).json({ message: error instanceof Error ? error.message : "Unable to update administrator permissions." });
  }
}

/* =========================================================
   DELETE ADMINISTRATOR
   ========================================================= */

export async function deleteAdministratorAccount(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  try {
    const adminId = typeof req.params.adminId === "string" ? req.params.adminId : "";

    if (!adminId) {
      return res.status(400).json({
        message: "Administrator ID is required.",
      });
    }

    if (!req.superAdmin?.superAdminId) {
      return res.status(401).json({
        message: "Super Admin authentication required.",
      });
    }

    const administrator = await deleteAdministrator(adminId);

    return res.status(200).json({
      message: "Administrator account deleted. The previous application was retained as rejected, and the user may submit a fresh application.",
      administrator,
    });
  } catch (error) {
    console.error("Failed to delete administrator:", error);

    return res.status(400).json({
      message: error instanceof Error
        ? error.message
        : "Failed to delete administrator.",
    });
  }
}


/* =========================================================
   RESET ADMIN LOGIN ATTEMPT LIMIT
   ========================================================= */

export async function resetAdministratorLoginAttempts(
  req: SuperAdminAuthenticatedRequest,
  res: Response
) {
  const adminId = typeof req.params.adminId === "string" ? req.params.adminId : "";
  const superAdminId = req.superAdmin?.superAdminId;
  if (!adminId) return res.status(400).json({ success: false, message: "Administrator ID is required." });
  if (!superAdminId) return res.status(401).json({ success: false, message: "Super Admin authentication required." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const admin = await client.query(
      "SELECT id, admin_code, full_name FROM public.admins WHERE id = $1::uuid FOR UPDATE",
      [adminId]
    );
    if (!admin.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Administrator was not found." });
    }

    const reset = await client.query(
      `UPDATE public.login_security
       SET failed_attempts = 0, attempt_limit = 3, lockout_level = 0, locked_until = NULL, updated_at = NOW()
       WHERE principal_type = 'ADMIN' AND principal_id = $1::uuid AND locked_until IS NOT NULL
       RETURNING failed_attempts, attempt_limit, lockout_level`,
      [adminId]
    );
    if (!reset.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, message: "This administrator does not currently have an active login lockout." });
    }

    await client.query(
      `UPDATE public.security_notifications
       SET status = 'REVOKED', reviewed_by_super_admin_id = $2::uuid, reviewed_at = NOW()
       WHERE principal_type = 'ADMIN' AND principal_id = $1::uuid
         AND event_type = 'ADMIN_LOCKOUT' AND status = 'OPEN'`,
      [adminId, superAdminId]
    );
    await client.query(
      `INSERT INTO public.audit_logs
       (actor_type, actor_id, actor_role, action, entity_table, entity_id, ip_address, metadata)
       VALUES ('SUPER_ADMIN', $1::uuid, 'SUPER_ADMIN', 'SUPER_ADMIN_RESET_ADMIN_LOGIN_ATTEMPTS',
               'admins', $2, $3, $4::jsonb)`,
      [superAdminId, adminId, req.ip ?? null, JSON.stringify({
        adminCode: admin.rows[0].admin_code,
        adminName: admin.rows[0].full_name,
        failedAttemptsResetTo: 0,
        attemptLimit: 3
      })]
    );
    await client.query("COMMIT");
    return res.status(200).json({
      success: true,
      message: "Login attempt limit reset. The administrator can sign in again.",
      security: { failedAttempts: 0, attemptLimit: 3, lockedUntil: null }
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Administrator login-attempt reset failed:", error);
    return res.status(500).json({ success: false, message: "Unable to reset this administrator's login attempt limit." });
  } finally {
    client.release();
  }
}
