import { Router } from "express";
import { loginTester, getTesterMe, previewTesterEnrollment } from "./tester.controller";
import { authenticateTesterToken } from "./tester-auth.middleware";

const router = Router();
router.post("/login", loginTester);
router.get("/me", authenticateTesterToken, getTesterMe);
router.post("/enrollment/preview", authenticateTesterToken, previewTesterEnrollment);
export default router;
