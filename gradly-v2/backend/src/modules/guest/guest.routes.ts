import { Router } from "express";
import { createGuest, getGuest, listGuestInstitutions, recordGuestEvent, saveGuestWorkspace } from "./guest.controller";

const router = Router();

router.get("/institutions", listGuestInstitutions);
router.post("/session", createGuest);
router.get("/session", getGuest);
router.post("/session/activity", recordGuestEvent);
router.patch("/session/workspace", saveGuestWorkspace);

export default router;
