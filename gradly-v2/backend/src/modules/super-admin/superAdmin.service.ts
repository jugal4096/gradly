import bcrypt from "bcrypt";

import {
  findSuperAdminByCode,
  updateSuperAdminLastLogin,
} from "./superAdmin.repository";

import { createSuperAdminToken } from "../../config/jwt";
import { executeSecureLogin } from "../auth-security/login-security.service";
import { recordLoginAttempt } from "../auth-security/login-security.repository";

interface SuperAdminLoginContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function authenticateSuperAdmin(
  adminCode: string,
  password: string,
  context?: SuperAdminLoginContext
) {
  const superAdmin = await findSuperAdminByCode(adminCode);

  // Do not disclose whether a code exists or whether the account is disabled.
  if (!superAdmin || superAdmin.status !== "ACTIVE") {
    await recordLoginAttempt(
      { principalType: "SUPER_ADMIN", principalId: null, ipAddress: context?.ipAddress, userAgent: context?.userAgent },
      false,
      "INVALID_CREDENTIALS"
    );
    throw new Error("Invalid Super Admin credentials.");
  }

  const loginResult = await executeSecureLogin(
    {
      principalType: "SUPER_ADMIN",
      principalId: superAdmin.id,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    },
    async () => {
      const passwordValid = await bcrypt.compare(
        password,
        superAdmin.password_hash
      );

      if (!passwordValid) {
        throw new Error("Invalid Super Admin credentials.");
      }

      return superAdmin;
    }
  );

  const authenticatedSuperAdmin = loginResult.result;
  const token = createSuperAdminToken({
    superAdminId: authenticatedSuperAdmin.id,
    adminCode: authenticatedSuperAdmin.admin_code,
    role: "SUPER_ADMIN",
  });

  const updatedSuperAdmin = await updateSuperAdminLastLogin(
    authenticatedSuperAdmin.id
  );

  if (!updatedSuperAdmin) {
    throw new Error("Unable to update Super Admin login information.");
  }

  return {
    token,
    superAdmin: updatedSuperAdmin,
  };
}
