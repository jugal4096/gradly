import { Router } from "express";

import { authenticateSuperAdminToken } from "../../middleware/super-admin-auth.middleware";
import {
  listGuests,
  listStudents,
  getStudent,
} from "./user-management.controller";

const router = Router();

// Every directory endpoint remains protected by Super Admin authentication.
router.use(authenticateSuperAdminToken);

// Keep the named route before /:userId so "guests" is not treated as a user ID.
router.get("/guests", listGuests);
router.get("/", listStudents);
router.get("/:userId", getStudent);

export default router;
