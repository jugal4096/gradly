import { Router } from "express";
import { createGuest, getGuest, listGuestInstitutions, recordGuestEvent, requestInstitution, saveGuestWorkspace } from "./guest.controller";

const router = Router();

router.get("/institutions", listGuestInstitutions);
router.post("/institution-requests", requestInstitution);
router.post("/session", createGuest);
router.get("/session", getGuest);
router.post("/session/activity", recordGuestEvent);
router.patch("/session/workspace", saveGuestWorkspace);

export default router;
