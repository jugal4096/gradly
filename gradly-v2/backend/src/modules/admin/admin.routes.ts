import { Router } from "express";
import { loginAdmin } from "./admin.controller";
import {
  authenticateAdminToken,
  AdminAuthenticatedRequest,
} from "../../middleware/admin-auth.middleware";
import { requireAdminPermission } from "../../middleware/permission.middleware";
import { listAdminCurriculum } from "./admin-curriculum.controller";

const router = Router();

router.post("/login", loginAdmin);

router.get(
  "/me",
  authenticateAdminToken,
  (req: AdminAuthenticatedRequest, res) => {
    res.status(200).json({
      message: "Admin authentication successful.",
      admin: req.admin,
    });
  }
);

router.get(
  "/curriculum",
  authenticateAdminToken,
  listAdminCurriculum
);

router.get(
  "/permission-test",
  authenticateAdminToken,
  requireAdminPermission("FEEDBACK_VIEW"),
  (_req: AdminAuthenticatedRequest, res) => {
    res.status(200).json({
      message: "Permission check successful.",
    });
  }
);

export default router;