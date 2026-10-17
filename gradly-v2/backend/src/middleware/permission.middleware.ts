import { Response, NextFunction } from "express";
import {
  AdminAuthenticatedRequest,
} from "./admin-auth.middleware";
import { hasAdminPermission } from "../modules/authorization.repository";

export function requireAdminPermission(permissionCode: string) {
  return async (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const admin = req.admin;

      if (!admin) {
        return res.status(401).json({
          message: "Admin authentication required.",
        });
      }

      const allowed = await hasAdminPermission(
        admin.adminId,
        permissionCode
      );

      if (!allowed) {
        return res.status(403).json({
          message: "You do not have permission to perform this action.",
          requiredPermission: permissionCode,
        });
      }

      next();
    } catch (error) {
      console.error("Permission check failed:", error);

      return res.status(500).json({
        message: "Unable to verify admin permissions.",
      });
    }
  };
}