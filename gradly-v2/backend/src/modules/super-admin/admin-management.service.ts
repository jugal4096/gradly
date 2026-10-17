import bcrypt from "bcrypt";
import {
  createAdmin,
  addAdminPermission,
  findAdminByCodeForManagement,
  findInstitutionById,
  findBranchById,
  getAdminPermissionsForManagement,
} from "./admin-management.repository";
import {
  isValidAdminPermission,
  AdminPermission,
} from "../../config/permissions";
import { pool } from "../../config/database";

type CreateAdminInput = {
  adminCode: string;
  institutionId: string;
  branchId?: string | null;
  fullName: string;
  email?: string | null;
  phoneNumber?: string | null;
  password: string;
  role: "DEPARTMENT_ADMIN" | "INSTITUTION_ADMIN";
  permissions: string[];
};

export async function provisionAdmin(
  input: CreateAdminInput
) {
  const {
    adminCode,
    institutionId,
    branchId,
    fullName,
    email,
    phoneNumber,
    password,
    role,
    permissions,
  } = input;

  /*
   * ---------------------------------------------------------
   * Basic validation
   * ---------------------------------------------------------
   */

  if (!adminCode.trim()) {
    throw new Error("Admin code is required.");
  }

  if (!institutionId.trim()) {
    throw new Error("Institution ID is required.");
  }

  if (!fullName.trim()) {
    throw new Error("Full name is required.");
  }

  if (password.length < 12) {
    throw new Error(
      "Admin password must contain at least 12 characters."
    );
  }

  /*
   * ---------------------------------------------------------
   * Role / branch validation
   * ---------------------------------------------------------
   */

  if (role === "DEPARTMENT_ADMIN" && !branchId) {
    throw new Error(
      "Department Admin must be assigned to a branch."
    );
  }

  if (role === "INSTITUTION_ADMIN" && branchId) {
    throw new Error(
      "Institution Admin cannot be assigned to a specific branch."
    );
  }

  /*
   * ---------------------------------------------------------
   * Permission validation
   * ---------------------------------------------------------
   */

  if (!Array.isArray(permissions) || permissions.length === 0) {
    throw new Error(
      "At least one admin permission is required."
    );
  }

  const invalidPermissions = permissions.filter(
    (permission) => !isValidAdminPermission(permission)
  );

  if (invalidPermissions.length > 0) {
    throw new Error(
      `Invalid permission codes: ${invalidPermissions.join(", ")}`
    );
  }

  const uniquePermissions = new Set(permissions);

  if (uniquePermissions.size !== permissions.length) {
    throw new Error(
      "Duplicate permission codes are not allowed."
    );
  }

  /*
   * ---------------------------------------------------------
   * Institution validation
   * ---------------------------------------------------------
   */

  const institution =
    await findInstitutionById(institutionId);

  if (!institution) {
    throw new Error(
      "The selected institution does not exist."
    );
  }

  /*
   * ---------------------------------------------------------
   * Branch validation
   * ---------------------------------------------------------
   */

  if (branchId) {
    const branch = await findBranchById(branchId);

    if (!branch) {
      throw new Error(
        "The selected branch does not exist."
      );
    }

    if (branch.institution_id !== institutionId) {
      throw new Error(
        "The selected branch does not belong to the selected institution."
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * Admin-code uniqueness
   * ---------------------------------------------------------
   */

  const existingAdmin =
    await findAdminByCodeForManagement(adminCode);

  if (existingAdmin) {
    throw new Error(
      "An admin with this admin code already exists."
    );
  }

  /*
   * ---------------------------------------------------------
   * Password hashing
   * ---------------------------------------------------------
   */

  const passwordHash = await bcrypt.hash(
    password,
    12
  );

  /*
   * ---------------------------------------------------------
   * Transaction
   * ---------------------------------------------------------
   */

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const admin = await createAdmin(
      client,
      adminCode,
      institutionId,
      branchId ?? null,
      fullName,
      email ?? null,
      phoneNumber ?? null,
      passwordHash,
      role
    );

    for (const permission of permissions as AdminPermission[]) {
      await addAdminPermission(
        client,
        admin.id,
        permission
      );
    }

    await client.query("COMMIT");

    const assignedPermissions =
      await getAdminPermissionsForManagement(
        admin.id
      );

    return {
      admin,
      institution,
      permissions: assignedPermissions,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}