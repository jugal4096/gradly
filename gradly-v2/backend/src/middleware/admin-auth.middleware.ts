import { Request, Response, NextFunction } from "express";
import { verifyAdminToken, AdminTokenPayload } from "../config/jwt";
import { isAdminActive } from "../modules/admin/admin.repository";

export interface AdminAuthenticatedRequest extends Request {
  admin?: AdminTokenPayload;
}

export async function authenticateAdminToken(
  req: AdminAuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Missing admin authentication token.",
    });
  }

  const token = authorization.substring("Bearer ".length).trim();

  if (!token) {
    return res.status(401).json({
      message: "Missing admin authentication token.",
    });
  }

  let decoded: AdminTokenPayload;

  try {
    decoded = verifyAdminToken(token);
  } catch {
    return res.status(401).json({
      message: "Invalid or expired admin authentication token.",
    });
  }

  try {
    if (!(await isAdminActive(decoded.adminId))) {
      return res.status(401).json({
        message: "Admin session is no longer active. Please sign in again.",
        code: "ADMIN_INACTIVE",
      });
    }

    req.admin = decoded;
    return next();
  } catch (error) {
    console.error("Admin account status check failed:", error);

    return res.status(503).json({
      message: "Unable to verify administrator account status.",
    });
  }
}
