import { Router } from "express";

import {
  createGuest,
  getGuest,
  listGuestBranches,
  updateGuestBranch,
} from "./guest.controller";

const router = Router();

router.get("/branches", listGuestBranches);
router.post("/session", createGuest);
router.get("/session", getGuest);
router.patch("/session/branch", updateGuestBranch);

export default router;