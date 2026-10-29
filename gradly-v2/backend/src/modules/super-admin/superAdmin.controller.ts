import { Request, Response } from "express";
import { authenticateSuperAdmin } from "./superAdmin.service";
import { LoginLockedError } from "../auth-security/login-security.service";
import { isSuperAdminLoginRateLimited } from "./superAdmin.login-rate-limit";

export async function loginSuperAdmin(
  req: Request,
  res: Response
) {
  try {
    const { adminCode, password } = req.body ?? {};

    if (
      typeof adminCode !== "string" ||
      typeof password !== "string" ||
      !adminCode.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Admin code and password are required.",
      });
    }

    const ipAddress = req.ip || req.socket.remoteAddress || null;
    if (ipAddress && await isSuperAdminLoginRateLimited(ipAddress)) {
      res.setHeader("Retry-After", "900");
      return res.status(429).json({ message: "Too many unsuccessful login attempts from this network. Please try again in 15 minutes." });
    }

    const result = await authenticateSuperAdmin(
      adminCode.trim(), password,
      { ipAddress, userAgent: req.get("user-agent") || null }
    );

    return res.status(200).json({
      token: result.token,
      superAdmin: result.superAdmin,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Super Admin login failed.";

    if (error instanceof LoginLockedError) {
      return res.status(423).json({
        message: "Too many unsuccessful login attempts. Your Super Admin account is temporarily locked.",
        lockedUntil: error.lockedUntil?.toISOString() ?? null,
      });
    }

    if (message === "Invalid Super Admin credentials.") {
      return res.status(401).json({ message });
    }

    console.error("Super Admin login failed:", error);

    return res.status(500).json({
      message: "Unable to sign in right now.",
    });
  }
}