import { Router } from "express";

import {
  authenticateFirebaseTokenForAdminApplication,
} from "../../middleware/auth.middleware";

import {
  getMyApplications,
  submitApplication,
} from "./admin-application.controller";

const router = Router();

// The Admin application is a review-request workflow, not account access.
// Disabled users may submit or track requests without regaining student access.
router.post(
  "/",
  authenticateFirebaseTokenForAdminApplication,
  submitApplication
);

// Get applications belonging to the authenticated Firebase identity.
router.get(
  "/mine",
  authenticateFirebaseTokenForAdminApplication,
  getMyApplications
);

export default router;
