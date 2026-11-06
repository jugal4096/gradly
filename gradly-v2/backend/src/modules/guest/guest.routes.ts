import { Router } from "express";
import { createGuest, getGuest, listGuestInstitutions, recordGuestEvent, saveGuestWorkspace } from "./guest.controller";
import { discoverInstitutions, getInstitutionRequestStatus, submitInstitutionRequest } from "./institution-discovery.controller";

const router = Router();

router.get("/institutions", listGuestInstitutions);
router.get("/institution-search", discoverInstitutions);
router.get("/institution-requests/:requestId", getInstitutionRequestStatus);
router.post("/institution-requests", submitInstitutionRequest);
router.post("/session", createGuest);
router.get("/session", getGuest);
router.post("/session/activity", recordGuestEvent);
router.patch("/session/workspace", saveGuestWorkspace);

export default router;
