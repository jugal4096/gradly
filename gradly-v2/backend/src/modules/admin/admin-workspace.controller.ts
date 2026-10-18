import type { Request, Response } from "express";
import { pool } from "../../config/database";
import type { AdminAuthenticatedRequest } from "../../middleware/admin-auth.middleware";

const allowedRequestTypes = new Set(["ADD_SUBJECT", "REMOVE_SUBJECT", "MODIFY_SUBJECT"]);

export async function listWorkspaceNotifications(req: AdminAuthenticatedRequest, res: Response) {
  const adminId = req.admin?.adminId;
  if (!adminId) return res.status(401).json({ success: false, message: "Admin authentication required." });
  try {
    const result = await pool.query(
      "SELECT id, notification_type AS \"type\", title, message, action_url AS \"actionUrl\", read_at AS \"readAt\", created_at AS \"createdAt\" FROM public.admin_workspace_notifications WHERE admin_id = $1 ORDER BY created_at DESC LIMIT 200",
      [adminId]
    );
    return res.json({ success: true, notifications: result.rows, unreadCount: result.rows.filter((row: { readAt: string | null }) => !row.readAt).length });
  } catch (error) {
    console.error("Admin workspace notifications load failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load notifications. Confirm the admin workspace governance migration has been applied." });
  }
}

export async function markWorkspaceNotificationRead(req: AdminAuthenticatedRequest, res: Response) {
  const adminId = req.admin?.adminId;
  if (!adminId) return res.status(401).json({ success: false, message: "Admin authentication required." });
  try {
    const result = await pool.query(
      "UPDATE public.admin_workspace_notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = $1 AND admin_id = $2 RETURNING id, read_at AS \"readAt\"",
      [req.params.notificationId, adminId]
    );
    if (!result.rowCount) return res.status(404).json({ success: false, message: "Notification not found for this Admin account." });
    return res.json({ success: true, notification: result.rows[0] });
  } catch (error) {
    console.error("Admin notification read update failed:", error);
    return res.status(500).json({ success: false, message: "Unable to update notification." });
  }
}

export async function listSubjectChangeRequests(req: AdminAuthenticatedRequest, res: Response) {
  const adminId = req.admin?.adminId;
  if (!adminId) return res.status(401).json({ success: false, message: "Admin authentication required." });
  try {
    const result = await pool.query(
      "SELECT id, request_type AS \"requestType\", reason, proposed_changes AS \"proposedChanges\", status, review_note AS \"reviewNote\", created_at AS \"createdAt\", reviewed_at AS \"reviewedAt\" FROM public.admin_subject_change_requests WHERE admin_id = $1 ORDER BY created_at DESC LIMIT 200",
      [adminId]
    );
    return res.json({ success: true, requests: result.rows });
  } catch (error) {
    console.error("Admin subject requests load failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load requests. Confirm the admin workspace governance migration has been applied." });
  }
}

export async function createSubjectChangeRequest(req: AdminAuthenticatedRequest, res: Response) {
  const admin = req.admin;
  if (!admin?.adminId || !admin.institutionId || !admin.programId || !admin.branchId) {
    return res.status(403).json({ success: false, message: "A complete institution, program and department assignment is required to submit curriculum requests." });
  }
  const { requestType, reason, proposedChanges, curriculumSubjectId } = req.body ?? {};
  if (typeof requestType !== "string" || !allowedRequestTypes.has(requestType)) {
    return res.status(400).json({ success: false, message: "Choose ADD_SUBJECT, REMOVE_SUBJECT or MODIFY_SUBJECT." });
  }
  if (typeof reason !== "string" || reason.trim().length < 10 || reason.trim().length > 2000) {
    return res.status(400).json({ success: false, message: "Provide a reason between 10 and 2,000 characters." });
  }
  if (!proposedChanges || typeof proposedChanges !== "object" || Array.isArray(proposedChanges)) {
    return res.status(400).json({ success: false, message: "Provide the proposed subject details as an object." });
  }
  try {
    let scopedCurriculumId: string | null = null;
    let scopedSemesterId: string | null = null;
    let scopedSubjectId: string | null = null;

    // Never trust subject or curriculum IDs supplied by the browser. For change/removal
    // requests, resolve the selected subject again inside the authenticated Admin scope.
    if (requestType !== "ADD_SUBJECT") {
      if (typeof curriculumSubjectId !== "string" || !curriculumSubjectId) {
        return res.status(400).json({ success: false, message: "Select a subject from your assigned curriculum." });
      }
      const subject = await pool.query(
        `SELECT cs.id, cs.curriculum_id, cs.semester_id
         FROM public.curriculum_subjects cs
         JOIN public.curricula c ON c.id = cs.curriculum_id
         WHERE cs.id = $1 AND c.institution_id = $2 AND c.program_id = $3 AND c.branch_id = $4
         LIMIT 1`,
        [curriculumSubjectId, admin.institutionId, admin.programId, admin.branchId]
      );
      if (!subject.rowCount) {
        return res.status(403).json({ success: false, message: "That subject is outside your assigned department. Refresh your curriculum and try again." });
      }
      scopedSubjectId = subject.rows[0].id;
      scopedCurriculumId = subject.rows[0].curriculum_id;
      scopedSemesterId = subject.rows[0].semester_id;
    }

    const result = await pool.query(
      `INSERT INTO public.admin_subject_change_requests
       (admin_id, institution_id, program_id, branch_id, curriculum_id, semester_id, curriculum_subject_id, request_type, reason, proposed_changes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
       RETURNING id, request_type AS "requestType", reason, proposed_changes AS "proposedChanges", status, created_at AS "createdAt"`,
      [admin.adminId, admin.institutionId, admin.programId, admin.branchId, scopedCurriculumId, scopedSemesterId, scopedSubjectId, requestType, reason.trim(), JSON.stringify(proposedChanges)]
    );
    return res.status(201).json({ success: true, message: "Request submitted to Super Admin for review.", request: result.rows[0] });
  } catch (error) {
    console.error("Admin subject request create failed:", error);
    return res.status(500).json({ success: false, message: "Unable to submit the curriculum request." });
  }
}

/** Super Admin can send a message to one active Admin or broadcast to all active Admins. */
export async function createAdminWorkspaceNotification(req: Request, res: Response) {
  const superAdminId = (req as any).superAdmin?.superAdminId;
  if (!superAdminId) return res.status(401).json({ success: false, message: "Super Admin authentication required." });
  const { adminId, title, message, notificationType, actionUrl } = req.body ?? {};
  if (typeof title !== "string" || title.trim().length < 3 || title.trim().length > 160 ||
      typeof message !== "string" || message.trim().length < 5 || message.trim().length > 4000) {
    return res.status(400).json({ success: false, message: "Title must be 3–160 characters and message 5–4,000 characters." });
  }
  if (adminId !== undefined && adminId !== null && typeof adminId !== "string") {
    return res.status(400).json({ success: false, message: "adminId must be an Admin ID or null for all active Admins." });
  }
  try {
    const recipients = adminId
      ? await pool.query("SELECT id FROM public.admins WHERE id = $1 AND status = 'ACTIVE'", [adminId])
      : await pool.query("SELECT id FROM public.admins WHERE status = 'ACTIVE'");
    if (adminId && !recipients.rowCount) return res.status(404).json({ success: false, message: "Active Admin account not found." });
    if (!recipients.rowCount) return res.status(404).json({ success: false, message: "No active Admin accounts found." });
    const values: unknown[] = [];
    const tuples = recipients.rows.map((row: { id: string }, index: number) => {
      const base = index * 5;
      values.push(row.id, typeof notificationType === "string" && notificationType.trim() ? notificationType.trim().slice(0, 50) : "SUPER_ADMIN_MESSAGE", title.trim(), message.trim(), typeof actionUrl === "string" && actionUrl.startsWith("/") ? actionUrl.slice(0, 300) : null);
      return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5})`;
    });
    const result = await pool.query(
      `INSERT INTO public.admin_workspace_notifications (admin_id, notification_type, title, message, action_url) VALUES ${tuples.join(",")} RETURNING id`,
      values
    );
    return res.status(201).json({ success: true, message: `Notification delivered to ${result.rowCount ?? 0} Admin account(s).`, deliveredCount: result.rowCount ?? 0 });
  } catch (error) {
    console.error("Super Admin notification delivery failed:", error);
    return res.status(500).json({ success: false, message: "Unable to send Admin notification. Confirm the admin workspace governance migration has been applied." });
  }
}
