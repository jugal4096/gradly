import { Router } from "express";

import {
  createGuest,
  getGuest,
} from "./guest.controller";

const router = Router();

router.post("/session", createGuest);
router.get("/session", getGuest);

export default router;