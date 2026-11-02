import { Router } from "express";
import { listStudentNotifications, markStudentNotificationRead } from "./student-notifications.controller";
import {
  authenticateFirebaseToken,
  authenticateFirebaseTokenForAdminApplication,
} from "../../middleware/auth.middleware";
import {
  getCurrentGradlyUser,
  syncAuthUser,
} from "./auth.controller";

const router = Router();

// Allow disabled or previously deleted users to establish their Firebase identity
// for the Admin application flow. syncUser preserves active=false on existing users.
router.post(
  "/sync",
  authenticateFirebaseTokenForAdminApplication,
  syncAuthUser
);

router.get(
  "/me",
  authenticateFirebaseToken,
  getCurrentGradlyUser
);

router.get("/notifications", authenticateFirebaseToken, listStudentNotifications);
router.patch("/notifications/:notificationId/read", authenticateFirebaseToken, markStudentNotificationRead);

export default router;
