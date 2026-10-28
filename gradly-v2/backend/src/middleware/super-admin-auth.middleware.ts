import {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  verifySuperAdminToken,
  SuperAdminTokenPayload,
} from "../config/jwt";
import { isSuperAdminActive } from "../modules/super-admin/superAdmin.repository";

export interface SuperAdminAuthenticatedRequest
  extends Request {
  superAdmin?: SuperAdminTokenPayload;
}

export async function authenticateSuperAdminToken(
  req: SuperAdminAuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Missing Super Admin authentication token.",
    });
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      message: "Missing Super Admin authentication token.",
    });
  }

  let decoded: SuperAdminTokenPayload;

  try {
    decoded = verifySuperAdminToken(token);
  } catch (error) {
    if (error instanceof Error && error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Super Admin session expired. Please sign in again.",
        code: "TOKEN_EXPIRED",
      });
    }

    return res.status(401).json({
      message: "Invalid Super Admin authentication token.",
      code: "INVALID_TOKEN",
    });
  }

  try {
    if (!(await isSuperAdminActive(decoded.superAdminId))) {
      return res.status(401).json({
        message: "Super Admin session is no longer active. Please sign in again.",
        code: "SUPER_ADMIN_INACTIVE",
      });
    }

    req.superAdmin = decoded;
    return next();
  } catch (error) {
    console.error("Super Admin account status check failed:", error);

    return res.status(503).json({
      message: "Unable to verify Super Admin account status.",
    });
  }
}
