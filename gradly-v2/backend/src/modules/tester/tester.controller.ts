import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { pool } from "../../config/database";
import { createTesterToken } from "../../config/jwt";
import { previewEnrollment } from "../academic/enrollment-intelligence.service";
import { TesterAuthenticatedRequest } from "./tester-auth.middleware";

export async function loginTester(req: Request, res: Response) {
  const { loginId, password } = req.body ?? {};
  if (typeof loginId !== "string" || !/^[a-zA-Z0-9._-]{3,80}$/.test(loginId.trim()) || typeof password !== "string" || !password) {
    return res.status(400).json({ message: "Enter a valid tester ID and password." });
  }
  try {
    const result = await pool.query(
      "SELECT id, login_id, password_hash, status FROM tester_accounts WHERE LOWER(login_id)=LOWER($1) LIMIT 1",
      [loginId.trim()],
    );
    const account = result.rows[0];
    if (!account || account.status !== "ACTIVE" || !(await bcrypt.compare(password, account.password_hash))) {
      return res.status(401).json({ message: "Invalid tester ID or password." });
    }
    await pool.query("UPDATE tester_accounts SET last_login_at=NOW(), updated_at=NOW() WHERE id=$1", [account.id]);
    const token = createTesterToken({ testerId: String(account.id), loginId: account.login_id, role: "TESTER" });
    return res.status(200).json({ token, tester: { loginId: account.login_id } });
  } catch (error) {
    console.error("Tester login failed:", error);
    return res.status(500).json({ message: "Unable to sign in to Tester Mode. Verify the tester account table is available." });
  }
}

async function requireActiveTester(req: TesterAuthenticatedRequest, res: Response): Promise<boolean> {
  const result = await pool.query("SELECT status FROM tester_accounts WHERE id=$1 LIMIT 1", [req.tester?.testerId]);
  if (result.rows[0]?.status === "ACTIVE") return true;
  res.status(401).json({ message: "This tester account is no longer active." });
  return false;
}

export async function getTesterMe(req: TesterAuthenticatedRequest, res: Response) {
  try {
    if (!(await requireActiveTester(req, res))) return;
    return res.json({ tester: { loginId: req.tester?.loginId, role: "TESTER" } });
  } catch {
    return res.status(500).json({ message: "Unable to verify tester account." });
  }
}

/** Read-only academic identity resolution. This endpoint never reads or writes student accounts. */
export async function previewTesterEnrollment(req: TesterAuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!(await requireActiveTester(req, res))) return;
    const institutionId = typeof req.body?.institutionId === "string" ? req.body.institutionId.trim() : "";
    const enrollmentNumber = typeof req.body?.enrollmentNumber === "string" ? req.body.enrollmentNumber.trim().toUpperCase() : "";
    if (!institutionId || !enrollmentNumber) {
      res.status(400).json({ success: false, message: "Choose an institution and enter an enrollment number." });
      return;
    }
    const data = await previewEnrollment(institutionId, enrollmentNumber);
    res.status(200).json({ success: true, data, isolated: true, readOnly: true });
  } catch (error) {
    if (error instanceof Error && /^(EMPTY_ENROLLMENT_NUMBER|INVALID_|DSE_ADMISSION_CYCLE_NOT_STARTED|FUTURE_ADMISSION_YEAR|BE_CBCS_DISCONTINUED|BE23_FIRST_YEAR_NOT_ALLOWED|BT_NEP_NOT_STARTED|POSTGRADUATE_REGULAR_ADMISSION_ONLY|ME_CBCS_DISCONTINUED|MT_NEP_NOT_STARTED)/.test(error.message)) {
      res.status(400).json({ success: false, message: "Invalid enrollment number." });
      return;
    }
    console.error("Tester enrollment preview failed:", error);
    res.status(500).json({ success: false, message: "Unable to resolve this test profile right now." });
  }
}
