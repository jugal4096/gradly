import { Router } from "express";
import { createGuest, getGuest, listGuestInstitutions, recordGuestEvent, requestInstitution, searchGuestInstitutions, saveGuestWorkspace, checkGuestIdAvailability, getInstitutionRequestStatus, deleteOwnGuestSession } from "./guest.controller";

const router = Router();

router.get("/institutions", listGuestInstitutions);
router.get("/guest-id-availability", checkGuestIdAvailability);
router.get("/institution-requests/status", getInstitutionRequestStatus);
router.get("/institution-search", searchGuestInstitutions);
router.post("/institution-requests", requestInstitution);
router.post("/session", createGuest);
router.delete("/session", deleteOwnGuestSession);
router.get("/session", getGuest);
router.post("/session/activity", recordGuestEvent);
router.patch("/session/workspace", saveGuestWorkspace);

export default router;
