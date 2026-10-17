import { Router } from "express";

import {
  createGuestSemester,
  addGuestSemesterCourse,
  getGuestSemesterCoursesController,
} from "./guest.academic.controller";

const router = Router();

router.post(
  "/semesters",
  createGuestSemester
);

router.post(
  "/semesters/courses",
  addGuestSemesterCourse
);

router.get(
  "/semesters/:guestSemesterId/courses",
  getGuestSemesterCoursesController
);

export default router;