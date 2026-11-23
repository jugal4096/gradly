import { Router } from "express";
import { loginTester, getTesterMe, previewTesterEnrollment, listTesterGecaResultSessions, matchTesterGecaResult, discoverTesterEnrollmentCandidates, listTesterDiscoveredResultSubjects, confirmTesterDiscoveredResultSubject } from "./tester.controller";
import { authenticateTesterToken } from "./tester-auth.middleware";

const router = Router();
router.post("/login", loginTester);
router.get("/me", authenticateTesterToken, getTesterMe);
router.post("/enrollment/preview", authenticateTesterToken, previewTesterEnrollment);
router.get("/results/sessions", authenticateTesterToken, listTesterGecaResultSessions);
router.post("/results/enrollment-candidates", authenticateTesterToken, discoverTesterEnrollmentCandidates);
router.post("/results/sessions/:resultId/match", authenticateTesterToken, matchTesterGecaResult);
router.get("/results/discovered-subjects", authenticateTesterToken, listTesterDiscoveredResultSubjects);
router.post("/results/discovered-subjects", authenticateTesterToken, confirmTesterDiscoveredResultSubject);
export default router;
