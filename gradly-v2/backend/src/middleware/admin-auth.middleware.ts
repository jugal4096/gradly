import { Request, Response, NextFunction } from "express";
import { verifyAdminToken, AdminTokenPayload } from "../config/jwt";

export interface AdminAuthenticatedRequest extends Request {
  admin?: AdminTokenPayload;
}

export function authenticateAdminToken(
  req: AdminAuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
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

    const decoded = verifyAdminToken(token);

    req.admin = decoded;

    next();
  } catch (error) {
    console.error("Admin token verification failed:", error);

    return res.status(401).json({
      message: "Invalid or expired admin authentication token.",
    });
  }
}