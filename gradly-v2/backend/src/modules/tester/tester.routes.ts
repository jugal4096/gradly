import { Router } from "express";
import { loginTester, getTesterMe } from "./tester.controller";
import { authenticateTesterToken } from "./tester-auth.middleware";

const router = Router();
router.post("/login", loginTester);
router.get("/me", authenticateTesterToken, getTesterMe);
export default router;
