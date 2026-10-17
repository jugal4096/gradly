import {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  verifySuperAdminToken,
  SuperAdminTokenPayload,
} from "../config/jwt";

export interface SuperAdminAuthenticatedRequest
  extends Request {
  superAdmin?: SuperAdminTokenPayload;
}

export function authenticateSuperAdminToken(
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

  try {
    req.superAdmin = verifySuperAdminToken(token);
    return next();
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        message: "Super Admin session expired. Please sign in again.",
        code: "TOKEN_EXPIRED",
      });
    }

    console.error("Super Admin token verification failed:", error);

    return res.status(401).json({
      message: "Invalid Super Admin authentication token.",
      code: "INVALID_TOKEN",
    });
  }
}