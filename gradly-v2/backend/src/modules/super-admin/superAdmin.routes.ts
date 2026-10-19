
import { Router, Response } from "express";

import { loginSuperAdmin } from "./superAdmin.controller";
import { createAdmin } from "./admin-management.controller";
import { getSuperAdminDashboardStats } from "./superAdmin-dashboard.controller";

import {
  authenticateSuperAdminToken,
  SuperAdminAuthenticatedRequest,
} from "../../middleware/super-admin-auth.middleware";

import userManagementRoutes from "./user-management.routes";
import { getAdminAuditActions, getAdminAuditEvents } from "./admin-audit.controller";
import { listFeedbackRequests } from "./superAdmin-feedback.controller";
import { listCurriculum, updateCurriculumSubject } from "./superAdmin-curriculum.controller";
import { acknowledgeSecurityNotification, listSecurityNotifications, revokeAccountLockout } from "./security-notifications.controller";
import { createAdminWorkspaceNotification, listAdminSubjectChangeRequestsForSuperAdmin, reviewAdminSubjectChangeRequest } from "../admin/admin-workspace.controller";
import { listForwardedStudentSyllabusFeedback } from "../admin/admin-privacy.controller";

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
 * FEEDBACK INBOX
 */
router.get("/feedback", authenticateSuperAdminToken, listFeedbackRequests);
router.get("/student-syllabus-feedback", authenticateSuperAdminToken, listForwardedStudentSyllabusFeedback);
router.get("/curriculum", authenticateSuperAdminToken, listCurriculum);
router.patch("/curriculum/:id", authenticateSuperAdminToken, updateCurriculumSubject);
router.get("/security-notifications", authenticateSuperAdminToken, listSecurityNotifications);
router.post("/admin-workspace-notifications", authenticateSuperAdminToken, createAdminWorkspaceNotification);
router.get("/admin-subject-change-requests", authenticateSuperAdminToken, listAdminSubjectChangeRequestsForSuperAdmin);
router.patch("/admin-subject-change-requests/:requestId/review", authenticateSuperAdminToken, reviewAdminSubjectChangeRequest);
router.patch("/security-notifications/:notificationId/acknowledge", authenticateSuperAdminToken, acknowledgeSecurityNotification);
router.patch("/security-notifications/:notificationId/revoke-lockout", authenticateSuperAdminToken, revokeAccountLockout);

/*
 * ADMIN AUDIT HISTORY
 */
router.get("/audit/admin-activity", authenticateSuperAdminToken, getAdminAuditEvents);
router.get("/audit/admin-actions", authenticateSuperAdminToken, getAdminAuditActions);

/*
 * USER MANAGEMENT
 */
router.use("/users", userManagementRoutes);

export default router;
