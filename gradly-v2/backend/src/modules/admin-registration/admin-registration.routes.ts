
import { Router } from "express";

import {
  authenticateFirebaseTokenForAdminApplication,
} from "../../middleware/auth.middleware";

import {
  completeAdminRegistration,
} from "./admin-registration.controller";

const router = Router();

router.post(
  "/complete",
  authenticateFirebaseTokenForAdminApplication,
  completeAdminRegistration
);

export default router;
