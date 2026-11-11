
import { Router, Response } from "express";

import { loginSuperAdmin } from "./superAdmin.controller";
import { createAdmin } from "./admin-management.controller";
import { getSuperAdminDashboardStats } from "./superAdmin-dashboard.controller";
import { archiveSuperAdminAuditLogs, listArchivedSuperAdminAuditLogs, restoreSuperAdminAuditLog } from "./superAdmin-audit-archive.controller";

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
import { getGuestSessionForSuperAdmin, listGuestSessionsForSuperAdmin } from "./superAdmin-guests.controller";
import { acknowledgePlatformRequest, deleteRequestRecord, listPlatformRequests, reviewPlatformRequest } from "../admin/platform-request.controller";
import { listEnrollmentGrievancesForSuperAdmin, deleteEnrollmentGrievanceForSuperAdmin, listEnrollmentGrievanceAuditHistory, listEnrollmentGrievanceAccountActions, reviewEnrollmentGrievance, setEnrollmentGrievanceStudentAccessForSuperAdmin, downloadEnrollmentGrievanceAttachmentForSuperAdmin } from "../student/student-enrollment-grievance.controller";

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
router.post("/audit-logs/archive", authenticateSuperAdminToken, archiveSuperAdminAuditLogs);
router.get("/audit-logs/archived", authenticateSuperAdminToken, listArchivedSuperAdminAuditLogs);
router.post("/audit-logs/:logId/restore", authenticateSuperAdminToken, restoreSuperAdminAuditLog);

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
router.get("/platform-requests", authenticateSuperAdminToken, listPlatformRequests);
router.get("/enrollment-grievances", authenticateSuperAdminToken, listEnrollmentGrievancesForSuperAdmin);
router.delete("/enrollment-grievances/:grievanceId", authenticateSuperAdminToken, deleteEnrollmentGrievanceForSuperAdmin);
router.get("/enrollment-grievances/:grievanceId/attachment", authenticateSuperAdminToken, downloadEnrollmentGrievanceAttachmentForSuperAdmin);
router.get("/enrollment-grievance-audit-history", authenticateSuperAdminToken, listEnrollmentGrievanceAuditHistory);
router.get("/enrollment-grievance-account-actions", authenticateSuperAdminToken, listEnrollmentGrievanceAccountActions);
router.patch("/enrollment-grievances/:grievanceId/review", authenticateSuperAdminToken, reviewEnrollmentGrievance);
// Compatibility for clients still issuing POST to the review action.
router.post("/enrollment-grievances/:grievanceId/review", authenticateSuperAdminToken, reviewEnrollmentGrievance);
router.patch("/enrollment-grievances/:grievanceId/student-access", authenticateSuperAdminToken, setEnrollmentGrievanceStudentAccessForSuperAdmin);
router.patch("/platform-requests/:requestId/acknowledge", authenticateSuperAdminToken, acknowledgePlatformRequest);
router.patch("/platform-requests/:requestId/review", authenticateSuperAdminToken, reviewPlatformRequest);
router.delete("/platform-requests/:source/:requestId", authenticateSuperAdminToken, deleteRequestRecord);
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
 * GUEST SESSION REVIEW — Super Admin only
 */
router.get("/guest-sessions", authenticateSuperAdminToken, listGuestSessionsForSuperAdmin);
router.get("/guest-sessions/:guestSessionId", authenticateSuperAdminToken, getGuestSessionForSuperAdmin);

/*
 * USER MANAGEMENT
 */
router.use("/users", userManagementRoutes);

export default router;
