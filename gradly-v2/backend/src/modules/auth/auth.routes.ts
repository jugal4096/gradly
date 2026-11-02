import { Router } from "express";
import { listStudentNotifications, markStudentNotificationRead } from "./student-notifications.controller";
import { authenticateFirebaseToken } from "../../middleware/auth.middleware";
import {
  getCurrentGradlyUser,
  syncAuthUser,
} from "./auth.controller";

const router = Router();

router.post(
  "/sync",
  authenticateFirebaseToken,
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