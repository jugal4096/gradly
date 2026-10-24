import { Router } from "express";
import { createGuest, getGuest, saveGuestWorkspace } from "./guest.controller";

const router = Router();

router.post("/session", createGuest);
router.get("/session", getGuest);
router.patch("/session/workspace", saveGuestWorkspace);

export default router;
