import { Router } from "express";
import { checkGuestIdAvailability, createGuest, deleteOwnGuestProfile, getGuest, listGuestInstitutions, recordGuestEvent, saveGuestWorkspace, selectGuestInstitution } from "./guest.controller";
import { discoverInstitutions, getInstitutionRequestStatus, submitInstitutionRequest } from "./institution-discovery.controller";

const router = Router();

router.get("/institutions", listGuestInstitutions);
router.get("/guest-id-availability", checkGuestIdAvailability);
router.get("/institution-search", discoverInstitutions);
router.get("/institution-requests/:requestId", getInstitutionRequestStatus);
router.post("/institution-requests", submitInstitutionRequest);
router.post("/session", createGuest);
router.patch("/session/institution", selectGuestInstitution);
router.get("/session", getGuest);
router.delete("/session", deleteOwnGuestProfile);
router.post("/session/activity", recordGuestEvent);
router.patch("/session/workspace", saveGuestWorkspace);

export default router;
