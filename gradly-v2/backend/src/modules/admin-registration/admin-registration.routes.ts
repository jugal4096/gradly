
import { Router } from "express";

import {
  authenticateFirebaseToken,
} from "../../middleware/auth.middleware";

import {
  completeAdminRegistration,
} from "./admin-registration.controller";

const router = Router();

router.post(
  "/complete",
  authenticateFirebaseToken,
  completeAdminRegistration
);

export default router;
