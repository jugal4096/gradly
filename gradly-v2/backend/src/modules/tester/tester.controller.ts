import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { pool } from "../../config/database";
import { createTesterToken } from "../../config/jwt";
import { TesterAuthenticatedRequest } from "./tester-auth.middleware";

const safeLoginId = (value: unknown) => typeof value === "string" && /^[a-zA-Z0-9._-]{3,80}$/.test(value.trim());

export async function loginTester(req: Request, res: Response) {
  const { loginId, password } = req.body ?? {};
  if (!safeLoginId(loginId) || typeof password !== "string" || !password) return res.status(400).json({ message: "Enter a valid tester ID and password." });
  try {
    const result = await pool.query("SELECT id, login_id, password_hash, status FROM tester_accounts WHERE LOWER(login_id)=LOWER($1) LIMIT 1", [loginId.trim()]);
    const account = result.rows[0];
    if (!account || account.status !== "ACTIVE" || !(await bcrypt.compare(password, account.password_hash))) return res.status(401).json({ message: "Invalid tester ID or password." });
    await pool.query("UPDATE tester_accounts SET last_login_at=NOW(), updated_at=NOW() WHERE id=$1", [account.id]);
    const token = createTesterToken({ testerId: String(account.id), loginId: account.login_id, role: "TESTER" });
    return res.status(200).json({ token, tester: { loginId: account.login_id } });
  } catch (error) {
    console.error("Tester login failed:", error);
    return res.status(500).json({ message: "Unable to sign in to Tester Mode. Ensure the tester migration has been applied." });
  }
}

export async function getTesterMe(req: TesterAuthenticatedRequest, res: Response) {
  try {
    const result = await pool.query("SELECT login_id, status FROM tester_accounts WHERE id=$1 LIMIT 1", [req.tester?.testerId]);
    const account = result.rows[0];
    if (!account || account.status !== "ACTIVE") return res.status(401).json({ message: "This tester account is disabled." });
    return res.json({ tester: { loginId: account.login_id } });
  } catch {
    return res.status(500).json({ message: "Unable to verify tester account." });
  }
}

export async function listTesterAccounts(_req: Request, res: Response) {
  try {
    const result = await pool.query("SELECT id, login_id, status, created_by, created_at, last_login_at FROM tester_accounts ORDER BY created_at DESC");
    return res.json({ testers: result.rows });
  } catch (error) {
    console.error("List tester accounts failed:", error);
    return res.status(500).json({ message: "Unable to load tester accounts. Apply the tester migration first." });
  }
}

export async function createTesterAccount(req: Request, res: Response) {
  const { loginId, password } = req.body ?? {};
  if (!safeLoginId(loginId)) return res.status(400).json({ message: "Tester ID must be 3–80 characters and use letters, numbers, dots, underscores or hyphens." });
  if (typeof password !== "string" || password.length < 10 || password.length > 128) return res.status(400).json({ message: "Set a password between 10 and 128 characters." });
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      "INSERT INTO tester_accounts (login_id,password_hash,created_by) VALUES ($1,$2,$3) RETURNING id,login_id,status,created_at",
      [loginId.trim(), passwordHash, String(req.body?.createdBy || "SUPER_ADMIN").slice(0,120)]
    );
    return res.status(201).json({ tester: result.rows[0], message: "Tester account created." });
  } catch (error: any) {
    if (error?.code === "23505") return res.status(409).json({ message: "That tester ID is already in use." });
    console.error("Create tester account failed:", error);
    return res.status(500).json({ message: "Unable to create tester account. Apply the tester migration first." });
  }
}

export async function setTesterAccountStatus(req: Request, res: Response) {
  const status = req.body?.status;
  if (!["ACTIVE","DISABLED"].includes(status)) return res.status(400).json({ message: "Status must be ACTIVE or DISABLED." });
  try {
    const result = await pool.query("UPDATE tester_accounts SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING id,login_id,status,created_at,last_login_at", [status, req.params.testerId]);
    if (!result.rowCount) return res.status(404).json({ message: "Tester account not found." });
    return res.json({ tester: result.rows[0] });
  } catch (error) {
    console.error("Update tester status failed:", error);
    return res.status(500).json({ message: "Unable to update tester account." });
  }
}

export async function deleteTesterAccount(req: Request, res: Response) {
  try {
    const result = await pool.query("DELETE FROM tester_accounts WHERE id=$1 RETURNING id,login_id", [req.params.testerId]);
    if (!result.rowCount) return res.status(404).json({ message: "Tester account not found." });
    return res.json({ message: "Tester account deleted." });
  } catch (error) {
    console.error("Delete tester account failed:", error);
    return res.status(500).json({ message: "Unable to delete tester account." });
  }
}
