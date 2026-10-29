import { Request, Response } from "express";
import { pool } from "../../config/database";

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

// Administrator activity, permissions, and targeted notices.
export async function getAdministratorActivity(req: SuperAdminAuthenticatedRequest, res: Response) {
  try {
    const adminId = req.params.adminId;
    const result = await pool.query(
      `SELECT id, actor_role, actor_type, actor_id, action, entity_table, entity_id,
              before_data, after_data, metadata, ip_address, created_at
       FROM public.audit_logs
       WHERE entity_table = 'admins' AND entity_id::text = $1
       ORDER BY created_at DESC
       LIMIT 200`,
      [adminId]
    );
    return res.status(200).json({ activity: result.rows, count: result.rows.length });
  } catch (error) {
    console.error("Failed to fetch administrator activity:", error);
    return res.status(500).json({ message: "Unable to load administrator activity. Verify the audit_logs schema." });
  }
}

export async function getAdministratorPermissions(req: SuperAdminAuthenticatedRequest, res: Response) {
  try {
    const adminId = req.params.adminId;
    const result = await pool.query(
      `SELECT permission_code, granted FROM public.admin_permissions
       WHERE admin_id = $1 ORDER BY permission_code`,
      [adminId]
    );
    return res.status(200).json({ permissions: result.rows });
  } catch (error) {
    console.error("Failed to fetch administrator permissions:", error);
    return res.status(500).json({ message: "Unable to load administrator permissions." });
  }
}

export async function updateAdministratorPermissions(req: SuperAdminAuthenticatedRequest, res: Response) {
  const adminId = req.params.adminId;
  const permissions = req.body?.permissions;
  if (!Array.isArray(permissions) || permissions.some((p: unknown) => typeof p !== "string" || !/^[A-Z][A-Z0-9_]{1,99}$/.test(p)) || new Set(permissions).size !== permissions.length) {
    return res.status(400).json({ message: "Provide a unique array of valid permission codes." });
  }
  if (!req.superAdmin?.superAdminId) return res.status(401).json({ message: "Super Admin authentication required." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const exists = await client.query("SELECT id FROM public.admins WHERE id = $1 FOR UPDATE", [adminId]);
    if (!exists.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Administrator not found." }); }
    await client.query("DELETE FROM public.admin_permissions WHERE admin_id = $1", [adminId]);
    for (const permission of permissions as string[]) {
      await client.query(
        `INSERT INTO public.admin_permissions (admin_id, permission_code, granted, created_at)
         VALUES ($1, $2, TRUE, NOW())`,
        [adminId, permission]
      );
    }
    await client.query(
      `INSERT INTO public.audit_logs (actor_role, action, entity_table, entity_id, after_data, metadata, actor_type, actor_id, created_at)
       VALUES ('SUPER_ADMIN', 'ADMIN_PERMISSIONS_UPDATED', 'admins', $1, $2::jsonb, $3::jsonb, 'SUPER_ADMIN', $4, NOW())`,
      [adminId, JSON.stringify({ permissions }), JSON.stringify({ permissions }), req.superAdmin.superAdminId]
    );
    await client.query("COMMIT");
    return res.status(200).json({ message: "Administrator permissions updated.", permissions });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to update administrator permissions:", error);
    return res.status(500).json({ message: "Unable to update administrator permissions." });
  } finally {
    client.release();
  }
}

export async function sendAdministratorNotice(req: SuperAdminAuthenticatedRequest, res: Response) {
  const adminId = req.params.adminId;
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  if (!title || title.length > 160 || !body || body.length > 5000) {
    return res.status(400).json({ message: "A title (max 160 characters) and message (max 5000 characters) are required." });
  }
  if (!req.superAdmin?.superAdminId) return res.status(401).json({ message: "Super Admin authentication required." });
  try {
    const recipient = await pool.query("SELECT id, full_name FROM public.admins WHERE id = $1 AND status <> 'DELETED' LIMIT 1", [adminId]);
    if (!recipient.rowCount) return res.status(404).json({ message: "Administrator not found." });
    const result = await pool.query(
      `INSERT INTO public.admin_notices (admin_id, title, body, created_by_super_admin_id, created_at)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING id, admin_id, title, body, created_at`,
      [adminId, title, body, req.superAdmin.superAdminId]
    );
    await pool.query(
      `INSERT INTO public.audit_logs (actor_role, action, entity_table, entity_id, after_data, metadata, actor_type, actor_id, created_at)
       VALUES ('SUPER_ADMIN', 'ADMIN_NOTICE_SENT', 'admins', $1, $2::jsonb, $3::jsonb, 'SUPER_ADMIN', $4, NOW())`,
      [adminId, JSON.stringify({ noticeId: result.rows[0].id, title }), JSON.stringify({ recipient: recipient.rows[0].full_name }), req.superAdmin.superAdminId]
    );
    return res.status(201).json({ message: "Notice saved for this administrator.", notice: result.rows[0] });
  } catch (error) {
    console.error("Failed to send administrator notice:", error);
    return res.status(500).json({ message: "Notice could not be saved. Ensure the admin_notices migration has been applied." });
  }
}
