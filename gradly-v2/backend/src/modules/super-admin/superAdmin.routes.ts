
import { Router, Response } from "express";

import { loginSuperAdmin } from "./superAdmin.controller";
import { createAdmin } from "./admin-management.controller";
import { getSuperAdminDashboardStats } from "./superAdmin-dashboard.controller";
import { getSuperAdminAuditLogs } from "./audit.controller";

import {
  authenticateSuperAdminToken,
  SuperAdminAuthenticatedRequest,
} from "../../middleware/super-admin-auth.middleware";

import userManagementRoutes from "./user-management.routes";

const router = Router();

/*
 * SUPER ADMIN AUTHENTICATION
 */
router.post("/login", loginSuperAdmin);

/*
 * SUPER ADMIN SESSION / PROFILE
 */
router.get(
  "/me",
  authenticateSuperAdminToken,
  (req: SuperAdminAuthenticatedRequest, res: Response) => {
    return res.status(200).json({
      message: "Super Admin authentication successful.",
      superAdmin: req.superAdmin,
    });
  }
);

/*
 * SUPER ADMIN DASHBOARD
 */
router.get(
  "/dashboard/stats",
  authenticateSuperAdminToken,
  getSuperAdminDashboardStats
);

/* Read-only audit history for privileged governance review. */
router.get(
  "/audit",
  authenticateSuperAdminToken,
  getSuperAdminAuditLogs
);

/*
 * ADMIN MANAGEMENT
 */
router.post(
  "/admins",
  authenticateSuperAdminToken,
  createAdmin
);

/*
 * USER MANAGEMENT
 */
router.use("/users", userManagementRoutes);

export default router;
