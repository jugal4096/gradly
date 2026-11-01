import { Router } from "express";
import { changeAdminPassword, loginAdmin } from "./admin.controller";
import {
  authenticateAdminToken,
  AdminAuthenticatedRequest,
} from "../../middleware/admin-auth.middleware";
import { requireAdminPermission } from "../../middleware/permission.middleware";
import { listAdminCurriculum } from "./admin-curriculum.controller";
import { getAdminWorkspaceProfile } from "./admin.repository";
import { createSubjectChangeRequest, listSubjectChangeRequests, listWorkspaceNotifications, markWorkspaceNotificationRead } from "./admin-workspace.controller";
import { getAdminPrivacyActivity, listDepartmentSyllabusFeedback, reviewDepartmentSyllabusFeedback } from "./admin-privacy.controller";

const router = Router();

router.post("/login", loginAdmin);
router.post("/change-password", authenticateAdminToken, changeAdminPassword);

router.get(
  "/me",
  authenticateAdminToken,
  async (req: AdminAuthenticatedRequest, res) => {
    try {
      const adminId = req.admin?.adminId;
      if (!adminId) return res.status(401).json({ success: false, message: "Admin session is missing." });
      const admin = await getAdminWorkspaceProfile(adminId);
      if (!admin || admin.status !== "ACTIVE") return res.status(403).json({ success: false, message: "This Admin account is not active." });
      return res.status(200).json({ success: true, message: "Admin authentication successful.", admin });
    } catch (error) {
      console.error("Admin workspace profile load failed:", error);
      return res.status(500).json({ success: false, message: "Unable to load Admin workspace profile." });
    }
  }
);

router.get(
  "/curriculum",
  authenticateAdminToken,
  listAdminCurriculum
);

router.get("/workspace-notifications", authenticateAdminToken, listWorkspaceNotifications);
router.patch("/workspace-notifications/:notificationId/read", authenticateAdminToken, markWorkspaceNotificationRead);
router.get("/subject-change-requests", authenticateAdminToken, listSubjectChangeRequests);
router.post("/subject-change-requests", authenticateAdminToken, createSubjectChangeRequest);
router.get("/privacy-activity", authenticateAdminToken, getAdminPrivacyActivity);
router.get("/student-syllabus-feedback", authenticateAdminToken, listDepartmentSyllabusFeedback);
router.patch("/student-syllabus-feedback/:feedbackId/review", authenticateAdminToken, reviewDepartmentSyllabusFeedback);

router.get(
  "/permission-test",
  authenticateAdminToken,
  requireAdminPermission("FEEDBACK_VIEW"),
  (_req: AdminAuthenticatedRequest, res) => {
    res.status(200).json({
      message: "Permission check successful.",
    });
  }
);

export default router;