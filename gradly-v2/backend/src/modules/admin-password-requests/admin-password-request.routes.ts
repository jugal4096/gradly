import { Router, type Request, type Response, type RequestHandler } from "express";
import { pool } from "../../config/database";
import { authenticateFirebaseToken, type AuthenticatedRequest } from "../../middleware/auth.middleware";
import { authenticateSuperAdminToken, type SuperAdminAuthenticatedRequest } from "../../middleware/super-admin-auth.middleware";

const router = Router();
const superAdminAuth = authenticateSuperAdminToken as RequestHandler;

function firebaseIdentity(req: Request) {
  const user = (req as AuthenticatedRequest).firebaseUser;
  if (!user?.uid || !user?.email || user.emailVerified !== true) {
    throw Object.assign(
      new Error("Sign in with the verified Google account linked to your administrator account."),
      { statusCode: 401 }
    );
  }
  return { uid: String(user.uid), email: String(user.email).trim().toLowerCase() };
}

function fail(res: Response, error: unknown) {
  const rawStatus =
    typeof error === "object" && error !== null && "statusCode" in error
      ? Number((error as { statusCode?: unknown }).statusCode)
      : 500;
  const status = rawStatus;
  return res.status(status >= 400 && status <= 599 ? status : 500).json({
    success: false,
    message: error instanceof Error ? error.message : "Password request failed."
  });
}

router.post("/", authenticateFirebaseToken, async (req, res) => {
  try {
    const identity = firebaseIdentity(req);
    const adminCode = typeof req.body?.admin_code === "string" ? req.body.admin_code.trim() : "";
    if (!/^[A-Za-z0-9_-]{4,32}$/.test(adminCode)) {
      return res.status(400).json({ success: false, message: "Enter the Admin ID linked to your account." });
    }

    const admin = await pool.query(
      `SELECT id, admin_code, email, status, user_id
       FROM public.admins
       WHERE LOWER(email) = $1 AND UPPER(admin_code) = UPPER($2)
       LIMIT 1`,
      [identity.email, adminCode]
    );
    if (!admin.rowCount) {
      return res.status(403).json({ success: false, message: "This Google account and Admin ID do not match an administrator record." });
    }
    const record = admin.rows[0];
    if (String(record.status).toUpperCase() !== "ACTIVE") {
      return res.status(403).json({ success: false, message: "Only active administrators can request a password change." });
    }

    const inserted = await pool.query(
      `INSERT INTO public.admin_password_change_requests
        (admin_id, admin_code, admin_email, firebase_uid, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'PENDING', NOW(), NOW())
       ON CONFLICT (admin_id) WHERE status = 'PENDING' DO NOTHING
       RETURNING id, admin_code, admin_email, status, created_at, reviewed_at, review_note`,
      [record.id, record.admin_code, identity.email, identity.uid]
    );
    if (!inserted.rowCount) {
      const existing = await pool.query(
        `SELECT id, admin_code, admin_email, status, created_at, reviewed_at, review_note
         FROM public.admin_password_change_requests
         WHERE admin_id = $1 AND status = 'PENDING'
         ORDER BY created_at DESC LIMIT 1`,
        [record.id]
      );
      return res.status(409).json({ success: false, message: "A password-change request is already waiting for Super Admin review.", request: existing.rows[0] });
    }

    return res.status(201).json({ success: true, message: "Password-change request sent to Super Admin for review.", request: inserted.rows[0] });
  } catch (error) {
    return fail(res, error);
  }
});

router.get("/mine", authenticateFirebaseToken, async (req, res) => {
  try {
    const identity = firebaseIdentity(req);
    const result = await pool.query(
      `SELECT r.id, r.admin_code, r.admin_email, r.status, r.created_at, r.reviewed_at, r.review_note, r.completed_at
       FROM public.admin_password_change_requests r
       WHERE r.firebase_uid = $1 AND LOWER(r.admin_email) = $2
       ORDER BY r.created_at DESC LIMIT 20`,
      [identity.uid, identity.email]
    );
    return res.json({ success: true, requests: result.rows });
  } catch (error) {
    return fail(res, error);
  }
});

// Super Admin inbox: this is the in-app notification/approval queue.
router.get("/review", superAdminAuth, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.admin_code, r.admin_email, r.status, r.created_at, r.reviewed_at, r.review_note,
              a.full_name, a.institution_id, i.name AS institution_name, b.name AS branch_name
       FROM public.admin_password_change_requests r
       JOIN public.admins a ON a.id = r.admin_id
       LEFT JOIN public.institutions i ON i.id = a.institution_id
       LEFT JOIN public.branches b ON b.id = a.branch_id
       ORDER BY CASE WHEN r.status = 'PENDING' THEN 0 ELSE 1 END, r.created_at DESC
       LIMIT 200`
    );
    return res.json({ success: true, requests: result.rows });
  } catch (error) {
    return fail(res, error);
  }
});

router.patch("/:requestId/review", superAdminAuth, async (req: Request, res: Response) => {
  try {
    const decision = req.body?.decision;
    const note = typeof req.body?.review_note === "string" ? req.body.review_note.trim().slice(0, 1000) : "";
    if (!["APPROVED", "REJECTED"].includes(decision)) {
      return res.status(400).json({ success: false, message: "Decision must be APPROVED or REJECTED." });
    }
    if (decision === "REJECTED" && !note) {
      return res.status(400).json({ success: false, message: "Provide a reason when rejecting a request." });
    }
    const result = await pool.query(
      `UPDATE public.admin_password_change_requests
       SET status = $2, review_note = $3, reviewed_at = NOW(), reviewed_by_super_admin_id = $4, updated_at = NOW()
       WHERE id = $1 AND status = 'PENDING'
       RETURNING id, admin_code, admin_email, status, created_at, reviewed_at, review_note`,
      [req.params.requestId, decision, note || null, (req as SuperAdminAuthenticatedRequest).superAdmin?.superAdminId ?? null]
    );
    if (!result.rowCount) {
      return res.status(409).json({ success: false, message: "Request not found or already reviewed." });
    }
    return res.json({ success: true, message: decision === "APPROVED" ? "Password request approved. Super Admin must complete the password reset." : "Password change request rejected.", request: result.rows[0] });
  } catch (error) {
    return fail(res, error);
  }
});

export default router;
