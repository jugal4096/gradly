import { Router } from "express";
import { createGuest, getGuest, listGuestInstitutions, listIndianCities, listIndianStates, recordGuestEvent, requestInstitution, searchGuestInstitutions, saveGuestWorkspace } from "./guest.controller";

const router = Router();

router.get("/institutions", listGuestInstitutions);
router.get("/institution-search", searchGuestInstitutions);
router.get("/india/states", listIndianStates);
router.get("/india/cities", listIndianCities);
router.post("/institution-requests", requestInstitution);
router.post("/session", createGuest);
router.get("/session", getGuest);
router.post("/session/activity", recordGuestEvent);
router.patch("/session/workspace", saveGuestWorkspace);

export default router;
