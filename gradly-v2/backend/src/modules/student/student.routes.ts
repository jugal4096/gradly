import { Router } from "express";

import {
  authenticateFirebaseToken,
} from "../../middleware/auth.middleware";

import {
  getProfile,
  createStudentProfileController,
} from "./student.controller";

const router = Router();

router.use(authenticateFirebaseToken);

router.get("/profile", getProfile);

router.post(
  "/profile",
  createStudentProfileController
);

export default router;