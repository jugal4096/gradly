import type { Request, Response } from "express";
import { pool } from "../../config/database";
import type { AdminAuthenticatedRequest } from "../../middleware/admin-auth.middleware";
import type { SuperAdminAuthenticatedRequest } from "../../middleware/super-admin-auth.middleware";

const allowedRequestTypes = new Set(["ADD_SUBJECT", "REMOVE_SUBJECT", "MODIFY_SUBJECT", "RENAME_CURRICULUM", "DELETE_CURRICULUM"]);

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
  const { requestType, reason, proposedChanges, curriculumSubjectId, curriculumId } = req.body ?? {};
  if (typeof requestType !== "string" || !allowedRequestTypes.has(requestType)) {
    return res.status(400).json({ success: false, message: "Choose a supported subject or curriculum change request." });
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

    // Resolve every submitted ID on the server and enforce the Admin's assigned scope.
    if (requestType === "RENAME_CURRICULUM" || requestType === "DELETE_CURRICULUM") {
      if (typeof curriculumId !== "string" || !curriculumId) {
        return res.status(400).json({ success: false, message: "Select a curriculum to change." });
      }
      const curriculum = await pool.query(
        `SELECT id FROM public.curricula
         WHERE id = $1 AND institution_id = $2 AND program_id = $3 AND branch_id = $4
         LIMIT 1`,
        [curriculumId, admin.institutionId, admin.programId, admin.branchId]
      );
      if (!curriculum.rowCount) {
        return res.status(403).json({ success: false, message: "That curriculum is outside your assigned department." });
      }
      scopedCurriculumId = curriculum.rows[0].id;
      if (requestType === "RENAME_CURRICULUM" && typeof proposedChanges.curriculumName !== "string") {
        return res.status(400).json({ success: false, message: "Provide the proposed curriculum name." });
      }
    } else if (requestType !== "ADD_SUBJECT") {
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
export async function createAdminWorkspaceNotification(req: SuperAdminAuthenticatedRequest, res: Response) {
  const superAdminId = req.superAdmin?.superAdminId;
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


export async function listAdminSubjectChangeRequestsForSuperAdmin(req: SuperAdminAuthenticatedRequest, res: Response) {
  if (!req.superAdmin?.superAdminId) return res.status(401).json({ success: false, message: "Super Admin authentication required." });
  try {
    const result = await pool.query(
      `SELECT r.id, r.admin_id AS "adminId", a.admin_code AS "adminCode", a.full_name AS "adminName",
              i.name AS institution, p.name AS program, b.name AS department,
              r.request_type AS "requestType", r.reason, r.proposed_changes AS "proposedChanges",
              r.status, r.review_note AS "reviewNote", r.created_at AS "createdAt", r.reviewed_at AS "reviewedAt"
       FROM public.admin_subject_change_requests r
       JOIN public.admins a ON a.id = r.admin_id
       JOIN public.institutions i ON i.id = r.institution_id
       LEFT JOIN public.programs p ON p.id = r.program_id
       LEFT JOIN public.branches b ON b.id = r.branch_id
       ORDER BY CASE WHEN r.status = 'PENDING' THEN 0 ELSE 1 END, r.created_at DESC
       LIMIT 500`
    );
    return res.json({ success: true, requests: result.rows });
  } catch (error) {
    console.error("Super Admin subject requests load failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load Admin subject requests. Confirm the admin workspace governance migration has been applied." });
  }
}

export async function reviewAdminSubjectChangeRequest(req: SuperAdminAuthenticatedRequest, res: Response) {
  const superAdminId = req.superAdmin?.superAdminId;
  if (!superAdminId) return res.status(401).json({ success: false, message: "Super Admin authentication required." });
  const { status, reviewNote } = req.body ?? {};
  if (!["APPROVED", "REJECTED"].includes(status)) return res.status(400).json({ success: false, message: "Choose APPROVED or REJECTED." });
  if (typeof reviewNote !== "string" || reviewNote.trim().length < 3 || reviewNote.trim().length > 2000) {
    return res.status(400).json({ success: false, message: "Enter a review note between 3 and 2,000 characters." });
  }
  try {
    const result = await pool.query(
      `UPDATE public.admin_subject_change_requests
       SET status = $2, reviewed_by = $3, reviewed_at = NOW(), review_note = $4, updated_at = NOW()
       WHERE id = $1 AND status = 'PENDING'
       RETURNING id, status, review_note AS "reviewNote", reviewed_at AS "reviewedAt"`,
      [req.params.requestId, status, superAdminId, reviewNote.trim()]
    );
    if (!result.rowCount) return res.status(404).json({ success: false, message: "Pending subject request not found. It may already have been reviewed." });
    const request = await pool.query("SELECT admin_id FROM public.admin_subject_change_requests WHERE id = $1", [req.params.requestId]);
    if (request.rowCount) {
      await pool.query(
        "INSERT INTO public.admin_workspace_notifications (admin_id, notification_type, title, message, action_url) VALUES ($1, $2, $3, $4, $5)",
        [request.rows[0].admin_id, "SUBJECT_REQUEST_REVIEW", `Subject change request ${status.toLowerCase()}`, reviewNote.trim(), "/admin/requests"]
      );
    }
    return res.json({ success: true, message: `Request ${status.toLowerCase()} and the Admin has been notified.`, request: result.rows[0] });
  } catch (error) {
    console.error("Super Admin subject request review failed:", error);
    return res.status(500).json({ success: false, message: "Unable to review this subject request." });
  }
}
