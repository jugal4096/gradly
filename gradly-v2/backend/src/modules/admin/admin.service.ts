import bcrypt from "bcrypt";

import {
  findAdminByCode,
  getAdminPermissions,
  updateAdminLastLogin,
} from "./admin.repository";

import { createAdminToken } from "../../config/jwt";

import {
  executeSecureLogin,
} from "../auth-security/login-security.service";

export class AdminPasswordExpiredError extends Error {
  public readonly code = "PASSWORD_EXPIRED";
  public readonly skipFailedAttempt = true;
  constructor() { super("Your password has expired. Submit a password-change request for Super Admin approval."); this.name = "AdminPasswordExpiredError"; }
}

interface AdminLoginContext {
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceFingerprintHash?: string | null;
}

export async function authenticateAdmin(
  adminCode: string,
  password: string,
  context?: AdminLoginContext
) {
  // ---------------------------------------------
  // 1. Validate incoming credentials
  // ---------------------------------------------

  if (
    typeof adminCode !== "string" ||
    !adminCode.trim() ||
    typeof password !== "string" ||
    !password
  ) {
    throw new Error("Invalid admin credentials.");
  }

  const normalizedAdminCode = adminCode.trim();

  // ---------------------------------------------
  // 2. Find administrator
  // ---------------------------------------------

  const admin = await findAdminByCode(normalizedAdminCode);

  // Do not reveal whether an account exists.
  if (!admin) {
    console.warn("[Admin Auth] Authentication rejected.", {
      reason: "ACCOUNT_NOT_FOUND",
    });

    throw new Error("Invalid admin credentials.");
  }

  // ---------------------------------------------
  // 3. Verify credentials through security engine
  // ---------------------------------------------

  const loginResult = await executeSecureLogin(
    {
      principalType: "ADMIN",
      principalId: admin.id,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      deviceFingerprintHash:
        context?.deviceFingerprintHash,
    },

    async () => {
      // Check password against the stored bcrypt hash.
      const passwordValid = await bcrypt.compare(
        password,
        admin.password_hash
      );

      // Safe diagnostic information; never log passwords or hashes.
      if (!passwordValid) {
        console.warn("[Admin Auth] Authentication rejected.", {
          reason: "PASSWORD_MISMATCH",
          principalType: "ADMIN",
          principalId: admin.id,
        });

        throw new Error("Invalid admin credentials.");
      }

      // Expired credentials are not counted as a wrong-password attempt.
      if (admin.password_expires_at && new Date(admin.password_expires_at).getTime() <= Date.now()) {
        throw new AdminPasswordExpiredError();
      }

      // Only active administrators may authenticate.
      if (admin.status !== "ACTIVE") {
        console.warn("[Admin Auth] Authentication rejected.", {
          reason: "ACCOUNT_NOT_ACTIVE",
          principalId: admin.id,
          status: admin.status,
        });

        throw new Error("Invalid admin credentials.");
      }

      return admin;
    }
  );

  // ---------------------------------------------
  // 4. Get authenticated administrator
  // ---------------------------------------------

  const authenticatedAdmin = loginResult.result;

  if (!authenticatedAdmin) {
    throw new Error("Invalid admin credentials.");
  }

  // ---------------------------------------------
  // 5. Update last login
  // ---------------------------------------------

  const updatedAdmin = await updateAdminLastLogin(
    authenticatedAdmin.id
  );

  if (!updatedAdmin) {
    throw new Error(
      "Unable to update administrator login information."
    );
  }

  // ---------------------------------------------
  // 6. Retrieve administrator permissions
  // ---------------------------------------------

  const permissions = await getAdminPermissions(
    authenticatedAdmin.id
  );

  // ---------------------------------------------
  // 7. Generate existing administrator JWT
  // ---------------------------------------------

  const token = createAdminToken({
    adminId: authenticatedAdmin.id,
    adminCode: authenticatedAdmin.admin_code,
    role: authenticatedAdmin.role,
    institutionId: authenticatedAdmin.institution_id,
    programId: authenticatedAdmin.program_id ?? null,
    branchId: authenticatedAdmin.branch_id,
  });

  // ---------------------------------------------
  // 8. Return authentication response
  // ---------------------------------------------

  return {
    token,

    admin: updatedAdmin,

    institution: {
      id: authenticatedAdmin.institution_id,
      name: authenticatedAdmin.institution_name,
    },

    branch: authenticatedAdmin.branch_id
      ? {
          id: authenticatedAdmin.branch_id,
          name: authenticatedAdmin.branch_name,
        }
      : null,

    permissions,

    security: {
      failedAttempts: loginResult.failedAttempts,
      attemptLimit: loginResult.attemptLimit,
      lockoutLevel: loginResult.lockoutLevel,
      passwordExpiresAt: authenticatedAdmin.password_expires_at ?? null,
      passwordChangeDue: Boolean(authenticatedAdmin.password_expires_at) &&
        new Date(authenticatedAdmin.password_expires_at).getTime() - Date.now() <= 3 * 24 * 60 * 60 * 1000,
    },
  };
}