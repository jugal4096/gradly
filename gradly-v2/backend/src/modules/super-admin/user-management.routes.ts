import { Router } from "express";

import {
  authenticateSuperAdminToken,
} from "../../middleware/super-admin-auth.middleware";

import {
  listStudents,
  getStudent,
  updateStudentStatus,
  getStudentActivityLog,
  listGuestSessions,
  listAcademicOptions,
} from "./user-management.controller";


const router = Router();

router.use(
  authenticateSuperAdminToken
);


router.get("/academic-options", listAcademicOptions);
router.get("/guests", listGuestSessions);

router.get(
  "/",
  listStudents
);


router.patch("/:userId/status", updateStudentStatus);
router.get("/:userId/activity", getStudentActivityLog);
router.get("/:userId", getStudent);


export default router;