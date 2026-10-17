
import { Router } from "express";

import {
  authenticateFirebaseToken,
} from "../../middleware/auth.middleware";

import {
  getMyApplications,
  submitApplication,
} from "./admin-application.controller";

const router = Router();

// Submit a new admin application.
router.post(
  "/",
  authenticateFirebaseToken,
  submitApplication
);

// Get applications belonging to the authenticated user.
router.get(
  "/mine",
  authenticateFirebaseToken,
  getMyApplications
);

export default router;