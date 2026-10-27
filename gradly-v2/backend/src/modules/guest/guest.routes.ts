import { Router } from "express";
import { createGuest, getGuest, listGuestInstitutions, listIndianCities, listIndianStates, recordGuestEvent, requestInstitution, searchGuestInstitutions, saveGuestWorkspace, updateGuestProfileController, deleteGuestAccount } from "./guest.controller";

const router = Router();

router.get("/institutions", listGuestInstitutions);
router.get("/institution-search", searchGuestInstitutions);
router.get("/india/states", listIndianStates);
router.get("/india/cities", listIndianCities);
router.post("/institution-requests", requestInstitution);
router.post("/session", createGuest);
router.get("/session", getGuest);
router.patch("/session/profile", updateGuestProfileController);
router.delete("/session", deleteGuestAccount);
router.post("/session/activity", recordGuestEvent);
router.patch("/session/workspace", saveGuestWorkspace);

export default router;
