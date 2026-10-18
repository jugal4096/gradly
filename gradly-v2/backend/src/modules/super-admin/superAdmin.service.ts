import bcrypt from "bcrypt";

import {
  findSuperAdminByCode,
  updateSuperAdminLastLogin,
} from "./superAdmin.repository";

import { createSuperAdminToken } from "../../config/jwt";
import { executeSecureLogin, type LoginAttemptContext } from "../auth-security/login-security.service";

export async function authenticateSuperAdmin(
  adminCode: string,
  password: string,
  context?: Pick<LoginAttemptContext, "ipAddress" | "userAgent">
) {
  const superAdmin = await findSuperAdminByCode(adminCode);

  if (!superAdmin) {
    throw new Error("Invalid Super Admin credentials.");
  }

  if (superAdmin.status !== "ACTIVE") {
    throw new Error("Super Admin account is not active.");
  }

  await executeSecureLogin(
    { principalType: "SUPER_ADMIN", principalId: superAdmin.id, ipAddress: context?.ipAddress, userAgent: context?.userAgent },
    async () => {
      const passwordValid = await bcrypt.compare(password, superAdmin.password_hash);
      if (!passwordValid) throw new Error("Invalid Super Admin credentials.");
      return superAdmin;
    }
  );

  const token = createSuperAdminToken({
    superAdminId: superAdmin.id,
    adminCode: superAdmin.admin_code,
    role: "SUPER_ADMIN",
  });

  const updatedSuperAdmin =
    await updateSuperAdminLastLogin(superAdmin.id);

  return {
    token,
    superAdmin: updatedSuperAdmin,
  };
}