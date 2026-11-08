import { Router } from "express";
import { submitStudentSyllabusFeedback } from "../admin/admin-privacy.controller";
import { authenticateFirebaseToken } from "../../middleware/auth.middleware";
import {
  getProfile,
  createStudentProfileController,
  updateStudentProfileController,
} from "./student.controller";

const router = Router();
router.use(authenticateFirebaseToken);
router.get("/profile", getProfile);
router.post("/syllabus-feedback", submitStudentSyllabusFeedback);
router.post("/profile", createStudentProfileController);
router.put("/profile", updateStudentProfileController);\nrouter.get("/academic/records", listStudentAcademicRecords);\nrouter.post("/academic/semesters", saveStudentSemesterResult);

export default router;
