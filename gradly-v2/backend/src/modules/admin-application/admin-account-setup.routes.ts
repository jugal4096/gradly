import { Router } from "express";

import {
  validateAdminSetup,
  completeAdminSetup,
} from "./admin-account-setup.controller";

const router = Router();

/*
 * Public setup-token validation.
 *
 * The token itself acts as the temporary authorization.
 */
router.get(
  "/:token",
  validateAdminSetup
);

/*
 * Complete admin username/password setup.
 */
router.post(
  "/",
  completeAdminSetup
);

export default router;