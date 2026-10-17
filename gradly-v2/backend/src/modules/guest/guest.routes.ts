import { Router } from "express";

import {
  createGuest,
  getGuest,\n  listGuestBranches,\n  updateGuestBranch,
} from "./guest.controller";

const router = Router();

router.get("/branches", listGuestBranches);\nrouter.post("/session", createGuest);
router.get("/session", getGuest);\nrouter.patch("/session/branch", updateGuestBranch);

export default router;