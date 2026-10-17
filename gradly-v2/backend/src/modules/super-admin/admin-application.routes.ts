
import { Router, type RequestHandler } from "express";
import { getSuperAdminDashboardStats } from "./superAdmin-dashboard.controller";
import {
  authenticateSuperAdminToken,
} from "../../middleware/super-admin-auth.middleware";

import {
  getApplications,
  getInstitutionBranches,
  reviewApplication,
  saveApplicationConfigurationController,
} from "./admin-application.controller";

const router = Router();

const authHandler =
  authenticateSuperAdminToken as RequestHandler;

const applicationsHandler =
  getApplications as RequestHandler;

const branchesHandler =
  getInstitutionBranches as RequestHandler;

const configurationHandler =
  saveApplicationConfigurationController as RequestHandler;

const reviewHandler =
  reviewApplication as RequestHandler;

/**
 * Validate all imported handlers during startup.
 */
const handlers: Record<string, unknown> = {
  authenticateSuperAdminToken: authHandler,
  getApplications: applicationsHandler,
  getInstitutionBranches: branchesHandler,
  saveApplicationConfigurationController: configurationHandler,
  reviewApplication: reviewHandler,
};

for (const [name, handler] of Object.entries(handlers)) {
  if (typeof handler !== "function") {
    throw new Error(
      `[Admin Applications Routes] Invalid handler "${name}". ` +
        "Check its export and import in the controller or middleware."
    );
  }
}
router.get(
  "/dashboard/stats",
  authenticateSuperAdminToken,
  getSuperAdminDashboardStats
);
/**
 * GET /api/super-admin/applications
 * GET /api/super-admin/applications?status=PENDING
 */
router.get(
  "/",
  authHandler,
  applicationsHandler
);

/**
 * GET /api/super-admin/applications/institutions/:institutionId/branches
 */
router.get(
  "/institutions/:institutionId/branches",
  authHandler,
  branchesHandler
);

/**
 * PATCH /api/super-admin/applications/:applicationId/configuration
 */
router.patch(
  "/:applicationId/configuration",
  authHandler,
  configurationHandler
);

/**
 * PATCH /api/super-admin/applications/:applicationId/review
 */
router.patch(
  "/:applicationId/review",
  authHandler,
  reviewHandler
);

export default router;
