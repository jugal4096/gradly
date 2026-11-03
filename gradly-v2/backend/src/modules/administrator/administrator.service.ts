import { isValidAdminPermission } from "../../config/permissions";
import { createAuditLog } from "../super-admin/user-management.repository";

type AdminAuditInput = {
  superAdminId: string;
  action: string;
  entityTable: string;
  entityId: string;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
};

async function createAdminAuditLog(input: AdminAuditInput) {
  return createAuditLog({
    actorType: "SUPER_ADMIN",
    actorId: input.superAdminId,
    actorRole: "SUPER_ADMIN",
    action: input.action,
    entityTable: input.entityTable,
    entityId: input.entityId,
    ipAddress: input.ipAddress,
    metadata: input.metadata,
  });
}
  
  import {
    findAdministrators,
    findAdministratorById,
    updateAdministratorStatus,
    updateAdministratorBranch,
    findBranchForInstitution,
    updateAdminshipExpiry,
    updateAdminGraduationDate,
    deleteAdministratorAccount,
    replaceAdministratorPermissions,
    getAdministratorPermissionsForAdmin,
    type AdministratorListFilters,
    type UpdateAdminStatus,
  } from "./administrator.repository";
  
  /* =========================================================
     LIST
     ========================================================= */
  
  export async function listAdministrators(
    filters: AdministratorListFilters = {}
  ) {
    return await findAdministrators(filters);
  }
  
  /* =========================================================
     DETAILS
     ========================================================= */
  
  export async function getAdministrator(
    adminId: string
  ) {
    const admin =
      await findAdministratorById(adminId);
  
    if (!admin) {
      throw new Error(
        "Administrator was not found."
      );
    }
  
    return admin;
  }
  
  /* =========================================================
     UPDATE ADMIN PERMISSIONS
     ========================================================= */

  export async function changeAdministratorPermissions(
    adminId: string,
    permissionCodes: string[],
    superAdminId: string,
    ipAddress?: string | null
  ) {
    const admin = await findAdministratorById(adminId);
    if (!admin) throw new Error("Administrator was not found.");
    if (!Array.isArray(permissionCodes)) throw new Error("Permissions must be an array.");
    const unique = [...new Set(permissionCodes)];
    const invalid = unique.filter((code) => !isValidAdminPermission(code));
    if (invalid.length) throw new Error("Invalid permission codes: " + invalid.join(", "));
    const previous = await getAdministratorPermissionsForAdmin(adminId);
    const permissions = await replaceAdministratorPermissions(adminId, unique);
    await createAdminAuditLog({
      superAdminId,
      action: "ADMIN_PERMISSIONS_UPDATED",
      entityTable: "admins",
      entityId: adminId,
      ipAddress,
      metadata: { previousPermissions: previous, newPermissions: permissions },
    });
    return permissions;
  }

  export async function getAdministratorPermissions(adminId: string) {
    return await getAdministratorPermissionsForAdmin(adminId);
  }

  /* =========================================================
     CHANGE STATUS
     ========================================================= */
  
  export async function changeAdministratorStatus(
    adminId: string,
    status: UpdateAdminStatus,
    superAdminId: string,
    ipAddress?: string | null
  ) {
    const admin =
      await findAdministratorById(adminId);
  
    if (!admin) {
      throw new Error(
        "Administrator was not found."
      );
    }
  
    if (
      status === "DISABLED" &&
      admin.status === "DISABLED"
    ) {
      throw new Error(
        "Administrator is already disabled."
      );
    }
  
    if (
      status === "SUSPENDED" &&
      admin.status === "SUSPENDED"
    ) {
      throw new Error(
        "Administrator is already suspended."
      );
    }
  
    if (
      status === "ACTIVE" &&
      admin.status === "ACTIVE"
    ) {
      throw new Error(
        "Administrator is already active."
      );
    }
  
    const updated =
      await updateAdministratorStatus(
        adminId,
        status
      );
  
    if (!updated) {
      throw new Error(
        "Unable to update administrator status."
      );
    }
  
    await createAdminAuditLog({
      superAdminId,
  
      action:
        `ADMIN_STATUS_CHANGED_TO_${status}`,
  
      entityTable:
        "admins",
  
      entityId:
        adminId,
  
      ipAddress,
  
      metadata: {
        previousStatus:
          admin.status,
  
        newStatus:
          status,
      },
    });
  
    return updated;
  }
  
  /* =========================================================
     CHANGE DEPARTMENT
     ========================================================= */
  
  export async function changeAdministratorDepartment(
    adminId: string,
    branchId: string,
    superAdminId: string,
    ipAddress?: string | null
  ) {
    const admin =
      await findAdministratorById(adminId);
  
    if (!admin) {
      throw new Error(
        "Administrator was not found."
      );
    }
  
    if (!branchId.trim()) {
      throw new Error(
        "Branch is required."
      );
    }
  
    const branch =
      await findBranchForInstitution(
        branchId,
        admin.institution_id
      );
  
    if (!branch) {
      throw new Error(
        "The selected branch does not belong to the administrator's institution."
      );
    }
  
    if (admin.branch_id === branchId) {
      throw new Error(
        "Administrator is already assigned to this department."
      );
    }
  
    const updated =
      await updateAdministratorBranch(
        adminId,
        branchId
      );
  
    if (!updated) {
      throw new Error(
        "Unable to change administrator department."
      );
    }
  
    await createAdminAuditLog({
      superAdminId,
  
      action:
        "ADMIN_DEPARTMENT_CHANGED",
  
      entityTable:
        "admins",
  
      entityId:
        adminId,
  
      ipAddress,
  
      metadata: {
        previousBranchId:
          admin.branch_id,
  
        previousBranchName:
          admin.branch_name,
  
        newBranchId:
          branch.id,
  
        newBranchName:
          branch.name,
      },
    });
  
    return updated;
  }
  
  /* =========================================================
     EXTEND ADMINSHIP
     ========================================================= */
  
  export async function extendAdministratorShip(
    adminId: string,
    newExpiry: string,
    superAdminId: string,
    ipAddress?: string | null
  ) {
    const admin =
      await findAdministratorById(adminId);
  
    if (!admin) {
      throw new Error(
        "Administrator was not found."
      );
    }
  
    const parsedExpiry =
      new Date(newExpiry);
  
    if (
      Number.isNaN(
        parsedExpiry.getTime()
      )
    ) {
      throw new Error(
        "Please provide a valid adminship expiry date."
      );
    }
  
    if (
      parsedExpiry <= new Date()
    ) {
      throw new Error(
        "Adminship expiry must be in the future."
      );
    }
  
    const updated =
      await updateAdminshipExpiry(
        adminId,
        parsedExpiry
      );
  
    if (!updated) {
      throw new Error(
        "Unable to extend adminship."
      );
    }
  
    await createAdminAuditLog({
      superAdminId,
  
      action:
        "ADMINSHIP_EXTENDED",
  
      entityTable:
        "admins",
  
      entityId:
        adminId,
  
      ipAddress,
  
      metadata: {
        previousExpiry:
          admin.adminship_expires_at,
  
        newExpiry:
          parsedExpiry.toISOString(),
      },
    });
  
    return updated;
  }
  
  /* =========================================================
     CHANGE GRADUATION DATE
     ========================================================= */
  
  export async function changeAdministratorGraduationDate(
    adminId: string,
    graduationDateValue: string,
    superAdminId: string,
    ipAddress?: string | null
  ) {
    const admin =
      await findAdministratorById(adminId);
  
    if (!admin) {
      throw new Error(
        "Administrator was not found."
      );
    }
  
    const graduationDate =
      new Date(
        `${graduationDateValue}T00:00:00.000Z`
      );
  
    if (
      Number.isNaN(
        graduationDate.getTime()
      )
    ) {
      throw new Error(
        "Please provide a valid graduation date."
      );
    }
  
    const today =
      new Date();
  
    today.setUTCHours(
      0,
      0,
      0,
      0
    );
  
    if (
      graduationDate < today
    ) {
      throw new Error(
        "Graduation date cannot be in the past."
      );
    }
  
    /*
     * Adminship expires at the END of
     * the graduation month.
     *
     * Example:
     * 2028-06-15
     *       ↓
     * 2028-06-30 23:59:59.999
     */
  
    const expiresAt =
      new Date(
        Date.UTC(
          graduationDate.getUTCFullYear(),
          graduationDate.getUTCMonth() + 1,
          0,
          23,
          59,
          59,
          999
        )
      );
  
    const updated =
      await updateAdminGraduationDate(
        adminId,
        graduationDate,
        expiresAt
      );
  
    if (!updated) {
      throw new Error(
        "Unable to update graduation date."
      );
    }
  
    await createAdminAuditLog({
      superAdminId,
  
      action:
        "ADMIN_GRADUATION_DATE_CHANGED",
  
      entityTable:
        "admins",
  
      entityId:
        adminId,
  
      ipAddress,
  
      metadata: {
        previousExpiry:
          admin.adminship_expires_at,
  
        newGraduationDate:
          graduationDate.toISOString(),
  
        newAdminshipExpiry:
          expiresAt.toISOString(),
      },
    });
  
    return updated;
  }

/* =========================================================
   DELETE ADMINISTRATOR ACCOUNT
   ========================================================= */

export async function deleteAdministrator(
  adminId: string
) {
  const deleted = await deleteAdministratorAccount(adminId);

  if (!deleted) {
    throw new Error("Administrator was not found.");
  }

  return deleted;
}
