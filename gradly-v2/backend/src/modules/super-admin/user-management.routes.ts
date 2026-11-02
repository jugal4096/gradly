import { Router } from "express";

import { authenticateSuperAdminToken } from "../../middleware/super-admin-auth.middleware";
import {
  listGuests,
  listBranches,
  listStudents,
  listDisabledAccounts,
  getStudent,
  listStudentActivity,
  listGuestActivity,
  getAcademicFilters,
  removeGuestSession,
  updateStudentStatus,
  deleteStudentAccount,
  sendStudentNotification,
} from "./user-management.controller";

const router = Router();

// Every directory endpoint remains protected by Super Admin authentication.
router.use(authenticateSuperAdminToken);

// Keep the named route before /:userId so "guests" is not treated as a user ID.
router.get("/guests", listGuests);
router.get("/disabled", listDisabledAccounts);
router.delete("/guests/:guestId", removeGuestSession);
router.get("/guests/:guestId/activity", listGuestActivity);
router.get("/filters", getAcademicFilters);
router.get("/branches", listBranches);
router.get("/:userId/activity", listStudentActivity);
router.patch("/:userId/status", updateStudentStatus);
router.delete("/:userId", deleteStudentAccount);
router.post("/:userId/notifications", sendStudentNotification);
router.get("/", listStudents);
router.get("/:userId", getStudent);

export default router;
