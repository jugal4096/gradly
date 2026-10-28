import { Router } from "express";

import { authenticateSuperAdminToken } from "../../middleware/super-admin-auth.middleware";
import {
  listGuests,
  listBranches,
  listStudents,
  getStudent,
  listStudentActivity,
  listGuestActivity,
  permanentlyDeleteGuest,
  updateStudentAccountStatus,
} from "./user-management.controller";

const router = Router();

// Every directory endpoint remains protected by Super Admin authentication.
router.use(authenticateSuperAdminToken);

// Keep the named route before /:userId so "guests" is not treated as a user ID.
router.get("/guests", listGuests);
router.get("/guests/:guestId/activity", listGuestActivity);
router.delete("/guests/:guestId", permanentlyDeleteGuest);
router.get("/branches", listBranches);
router.patch("/:userId/status", updateStudentAccountStatus);
router.get("/:userId/activity", listStudentActivity);
router.get("/", listStudents);
router.get("/:userId", getStudent);

export default router;
