import { Router } from "express";

import {
  authenticateSuperAdminToken,
} from "../../middleware/super-admin-auth.middleware";

import {
  listStudents,
  getStudent,
} from "./user-management.controller";


const router = Router();

router.use(
  authenticateSuperAdminToken
);


router.get(
  "/",
  listStudents
);


router.get(
  "/:userId",
  getStudent
);


export default router;