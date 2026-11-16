import { Router } from "express";
import { authenticateSuperAdminToken } from "../../middleware/super-admin-auth.middleware";
import { createTesterAccount, deleteTesterAccount, listTesterAccounts, setTesterAccountStatus } from "./tester-management.controller";

const router = Router();
router.use(authenticateSuperAdminToken);
router.get("/", listTesterAccounts);
router.post("/", createTesterAccount);
router.patch("/:testerId/status", setTesterAccountStatus);
router.delete("/:testerId", deleteTesterAccount);
export default router;
