
import { Router, Response } from "express";

import { loginSuperAdmin } from "./superAdmin.controller";
import { createAdmin } from "./admin-management.controller";
import { getSuperAdminDashboardStats } from "./superAdmin-dashboard.controller";
import { getSuperAdminWorkspace } from "./super-admin-workspace.controller";
import { listInstitutions, listInstitutionPrograms, createInstitution, createInstitutionProgram, createInstitutionBranch } from "./institution-management.controller";

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
router.get("/institutions", authenticateSuperAdminToken, listInstitutions);
router.post("/institutions", authenticateSuperAdminToken, createInstitution);
router.get("/institutions/:institutionId/programs", authenticateSuperAdminToken, listInstitutionPrograms);
router.post("/institutions/:institutionId/programs", authenticateSuperAdminToken, createInstitutionProgram);
router.post("/institutions/:institutionId/programs/:programId/branches", authenticateSuperAdminToken, createInstitutionBranch);
router.get("/workspace/:module", authenticateSuperAdminToken, getSuperAdminWorkspace);

router.use("/users", userManagementRoutes);

export default router;
