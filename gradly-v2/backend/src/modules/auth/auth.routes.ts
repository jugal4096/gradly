import { Router } from "express";
import { authenticateFirebaseToken } from "../../middleware/auth.middleware";
import {
  getCurrentGradlyUser,
  syncAuthUser,
} from "./auth.controller";

const router = Router();

router.post(
  "/sync",
  authenticateFirebaseToken,
  syncAuthUser
);

router.get(
  "/me",
  authenticateFirebaseToken,
  getCurrentGradlyUser
);

export default router;