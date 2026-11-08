import { Router } from "express";
import { submitStudentSyllabusFeedback } from "../admin/admin-privacy.controller";
import { authenticateFirebaseToken } from "../../middleware/auth.middleware";
import { getProfile, createStudentProfileController, updateStudentProfileController } from "./student.controller";
import { listStudentAcademicRecords, saveStudentSemesterResult } from "./student-academic.controller";
import { requestStudentInstitution } from "./student-institution.controller";
import { previewEnrollmentController } from "../academic/enrollment-intelligence.controller";

const router = Router();
router.use(authenticateFirebaseToken);
router.get("/profile", getProfile);
router.post("/syllabus-feedback", submitStudentSyllabusFeedback);
router.post("/profile", createStudentProfileController);
router.put("/profile", updateStudentProfileController);
router.post("/institution-requests", requestStudentInstitution);
router.post("/enrollment/preview", previewEnrollmentController);
router.get("/academic/records", listStudentAcademicRecords);
router.post("/academic/semesters", saveStudentSemesterResult);

export default router;
