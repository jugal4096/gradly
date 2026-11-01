import { Router } from "express";
import { submitStudentSyllabusFeedback } from "../admin/admin-privacy.controller";

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
router.post("/syllabus-feedback", submitStudentSyllabusFeedback);

router.post(
  "/profile",
  createStudentProfileController
);

export default router;