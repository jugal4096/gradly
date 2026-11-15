import { Router } from "express";
import { loginTester, getTesterMe, previewTesterEnrollment, listTesterGecaResultSessions, matchTesterGecaResult } from "./tester.controller";
import { authenticateTesterToken } from "./tester-auth.middleware";

const router = Router();
router.post("/login", loginTester);
router.get("/me", authenticateTesterToken, getTesterMe);
router.post("/enrollment/preview", authenticateTesterToken, previewTesterEnrollment);
router.get("/results/sessions", authenticateTesterToken, listTesterGecaResultSessions);
router.post("/results/sessions/:resultId/match", authenticateTesterToken, matchTesterGecaResult);
export default router;
