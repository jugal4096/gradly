import { Router } from "express";
import { createGuest, getGuest, recordGuestEvent, saveGuestWorkspace } from "./guest.controller";

const router = Router();

router.post("/session", createGuest);
router.get("/session", getGuest);
router.post("/session/activity", recordGuestEvent);
router.patch("/session/workspace", saveGuestWorkspace);

export default router;
