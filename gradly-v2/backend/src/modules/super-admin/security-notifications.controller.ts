import type { Request, Response } from "express";
import type { SuperAdminAuthenticatedRequest } from "../../middleware/super-admin-auth.middleware";
import { pool } from "../../config/database";

export async function listSecurityNotifications(_req: Request, res: Response) {
  try {
    const result = await pool.query("SELECT id, event_type, principal_type, principal_id, principal_code, principal_name, principal_email, message, metadata, status, locked_until, reviewed_at, created_at FROM public.security_notifications ORDER BY CASE WHEN status = 'OPEN' THEN 0 ELSE 1 END, created_at DESC LIMIT 300");
    return res.json({ success: true, notifications: result.rows });
  } catch (error) {
    console.error("Security notifications load failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load security notifications. Confirm the account-security migration has been applied." });
  }
}

export async function revokeAccountLockout(req: SuperAdminAuthenticatedRequest, res: Response) {
  const superAdminId = req.superAdmin?.superAdminId;
  if (!superAdminId) return res.status(401).json({ success: false, message: "Super Admin authentication required." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query("SELECT * FROM public.security_notifications WHERE id = $1 FOR UPDATE", [req.params.notificationId]);
    if (!found.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ success: false, message: "Security notification not found." }); }
    const n = found.rows[0];
    if (n.status === "REVOKED") { await client.query("ROLLBACK"); return res.status(409).json({ success: false, message: "This lockout has already been revoked." }); }
    if (!["ADMIN_LOCKOUT", "SUPER_ADMIN_LOCKOUT"].includes(n.event_type)) { await client.query("ROLLBACK"); return res.status(400).json({ success: false, message: "This notification is not a lockout event." }); }
    await client.query("UPDATE public.login_security SET failed_attempts = 0, attempt_limit = 3, lockout_level = 0, locked_until = NULL, updated_at = NOW() WHERE principal_type = $1 AND principal_id = $2", [n.principal_type, n.principal_id]);
    await client.query("UPDATE public.security_notifications SET status = 'REVOKED', reviewed_by_super_admin_id = $2, reviewed_at = NOW() WHERE id = $1", [n.id, superAdminId]);
    await client.query("COMMIT");
    return res.json({ success: true, message: "Account lockout revoked. The account can attempt to sign in again." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Account lockout revocation failed:", error);
    return res.status(500).json({ success: false, message: "Unable to revoke this lockout." });
  } finally { client.release(); }
}

export async function acknowledgeSecurityNotification(req: SuperAdminAuthenticatedRequest, res: Response) {
  const superAdminId = req.superAdmin?.superAdminId;
  if (!superAdminId) return res.status(401).json({ success: false, message: "Super Admin authentication required." });
  try {
    const result = await pool.query("UPDATE public.security_notifications SET status = 'ACKNOWLEDGED', reviewed_by_super_admin_id = $2, reviewed_at = NOW() WHERE id = $1 AND status = 'OPEN' RETURNING id, status", [req.params.notificationId, superAdminId]);
    if (!result.rowCount) return res.status(409).json({ success: false, message: "Notification not found or already reviewed." });
    return res.json({ success: true, message: "Security notification acknowledged.", notification: result.rows[0] });
  } catch (error) {
    console.error("Security notification acknowledgement failed:", error);
    return res.status(500).json({ success: false, message: "Unable to acknowledge notification." });
  }
}
