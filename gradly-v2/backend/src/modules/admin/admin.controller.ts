import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { pool } from "../../config/database";

import { authenticateAdmin } from "./admin.service";

import { InvalidLoginAttemptError, LoginLockedError } from "../auth-security/login-security.service";
import { AdminPasswordExpiredError } from "./admin.service";
import type { AdminAuthenticatedRequest } from "../../middleware/admin-auth.middleware";

export async function changeAdminPassword(req: AdminAuthenticatedRequest, res: Response) {
  try {
    const adminId = req.admin?.adminId;
    const { currentPassword, newPassword } = req.body ?? {};
    if (!adminId) return res.status(401).json({ message: "Admin session is missing." });
    if (typeof currentPassword !== "string" || !currentPassword || typeof newPassword !== "string" || newPassword.length < 12 || newPassword.length > 128) {
      return res.status(400).json({ message: "Enter your current password and a new password of 12–128 characters." });
    }
    const result = await pool.query("SELECT password_hash, password_expires_at FROM public.admins WHERE id = $1 AND status = 'ACTIVE' LIMIT 1", [adminId]);
    const admin = result.rows[0];
    if (!admin) return res.status(403).json({ message: "This administrator account is not active." });
    if (admin.password_expires_at && new Date(admin.password_expires_at).getTime() <= Date.now()) {
      return res.status(403).json({ code: "PASSWORD_EXPIRED", message: "Your password has expired. Submit a request for Super Admin approval." });
    }
    if (!await bcrypt.compare(currentPassword, admin.password_hash)) return res.status(401).json({ message: "Current password is incorrect." });
    if (await bcrypt.compare(newPassword, admin.password_hash)) return res.status(400).json({ message: "Choose a new password different from your current password." });
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query("UPDATE public.admins SET password_hash = $2, password_changed_at = NOW(), password_expires_at = NOW() + INTERVAL '1 month', updated_at = NOW() WHERE id = $1", [adminId, hash]);
    return res.json({ success: true, message: "Password changed successfully. It expires in one month." });
  } catch (error) {
    console.error("Admin password change failed:", error);
    return res.status(500).json({ message: "Unable to change password right now." });
  }
}
export async function loginAdmin(
  req: Request,
  res: Response
) {
  try {
    const {
      adminCode,
      password,
      deviceFingerprint,
    } = req.body;

    if (
      typeof adminCode !== "string" ||
      typeof password !== "string" ||
      !adminCode.trim() ||
      !password
    ) {
      return res.status(400).json({
        message:
          "Admin ID and password are required.",
      });
    }

    const result = await authenticateAdmin(
      adminCode.trim(),
      password,
      {
        ipAddress:
          req.ip ||
          req.socket.remoteAddress ||
          null,

        userAgent:
          req.get("user-agent") || null,

        /*
         * We are accepting the value for now.
         *
         * We will replace this with a server-side
         * HMAC-based device identifier later.
         */
        deviceFingerprintHash:
          typeof deviceFingerprint === "string"
            ? deviceFingerprint
            : null,
      }
    );

    return res.status(200).json({
      message: "Admin login successful.",
      ...result,
    });
  } catch (error) {
    console.error(
      "Admin login failed:",
      error
    );

    if (error instanceof AdminPasswordExpiredError) {
      return res.status(403).json({ code: "PASSWORD_EXPIRED", message: error.message });
    }

    if (error instanceof InvalidLoginAttemptError) {
      return res.status(401).json({ code: "INVALID_CREDENTIALS", message: error.message, attemptsRemaining: error.attemptsRemaining });
    }

    if (error instanceof LoginLockedError) {
      return res.status(423).json({
        message:
          "Too many unsuccessful login attempts. Your admin account is temporarily locked.",
        lockedUntil:
          error.lockedUntil.toISOString(),
      });
    }

    return res.status(401).json({
      message:
        "Invalid admin credentials.",
    });
  }
}