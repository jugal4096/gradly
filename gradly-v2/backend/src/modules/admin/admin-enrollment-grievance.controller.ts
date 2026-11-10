import type { Response } from "express";
import type { AdminAuthenticatedRequest } from "../../middleware/admin-auth.middleware";
import { pool } from "../../config/database";

type AdminScope = {
  adminId: string;
  institutionId: string;
  programId: string | null;
  branchId: string | null;
  role: string;
};

const reviewStatuses = new Set(["IN_REVIEW", "NEEDS_INFO", "RESOLVED", "REJECTED"]);

async function resolveAdminScope(req: AdminAuthenticatedRequest, res: Response): Promise<AdminScope | null> {
  const adminId = req.admin?.adminId;
  if (!adminId) {
    res.status(401).json({ success: false, message: "Admin authentication required." });
    return null;
  }

  const result = await pool.query(
    `SELECT a.id AS "adminId", a.institution_id AS "institutionId",
            COALESCE(a.program_id, b.program_id) AS "programId",
            a.branch_id AS "branchId", a.role
     FROM public.admins a
     LEFT JOIN public.branches b ON b.id = a.branch_id
     WHERE a.id = $1 AND a.status = 'ACTIVE'
       AND (a.admin_expires_at IS NULL OR a.admin_expires_at > NOW())
       AND (a.adminship_expires_at IS NULL OR a.adminship_expires_at > NOW())
     LIMIT 1`,
    [adminId],
  );

  if (!result.rowCount) {
    res.status(403).json({ success: false, message: "Your Admin account is inactive or expired." });
    return null;
  }

  const scope = result.rows[0] as AdminScope;
  if (!scope.institutionId || !["DEPARTMENT_ADMIN", "INSTITUTION_ADMIN"].includes(scope.role)) {
    res.status(403).json({ success: false, message: "Your Admin account does not have a valid grievance-review assignment." });
    return null;
  }
  if (scope.role === "DEPARTMENT_ADMIN" && !scope.programId) {
    res.status(403).json({ success: false, message: "Your department programme assignment is missing. Contact Super Admin." });
    return null;
  }
  return scope;
}

function addAcademicScope(scope: AdminScope, values: unknown[], alias = "c") {
  values.push(scope.institutionId);
  let where = `${alias}.institution_id = $${values.length}`;
  if (scope.programId) {
    values.push(scope.programId);
    where += ` AND ${alias}.program_id = $${values.length}`;
  }
  if (scope.branchId) {
    values.push(scope.branchId);
    where += ` AND ${alias}.branch_id = $${values.length}`;
  }
  return where;
}

export async function listDepartmentEnrollmentGrievances(req: AdminAuthenticatedRequest, res: Response) {
  try {
    const scope = await resolveAdminScope(req, res);
    if (!scope) return;
    const values: unknown[] = [];
    const academicScope = addAcademicScope(scope, values);
    const status = typeof req.query.status === "string" ? req.query.status : "ALL";
    const where = [academicScope];
    if (status !== "ALL") {
      if (!["PENDING", "IN_REVIEW", "NEEDS_INFO", "RESOLVED", "REJECTED"].includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid grievance status filter." });
      }
      values.push(status);
      where.push(`g.status = $${values.length}`);
    }

    const result = await pool.query(
      `SELECT g.id, g.enrollment_number AS "enrollmentNumber", g.category,
              g.description, g.proposed_correction AS "proposedCorrection",
              g.status, g.admin_note AS "adminNote", g.created_at AS "createdAt",
              g.updated_at AS "updatedAt", g.reviewed_at AS "reviewedAt",
              i.name AS institution, u.display_name AS "studentName", u.email AS "studentEmail",
              sp.student_identifier AS "studentIdentifier",
              p.name AS programme, b.name AS branch, sc.name AS scheme,
              COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'id', e.id, 'fileName', e.original_filename, 'mimeType', e.mime_type,
                'fileSize', e.file_size, 'uploadedAt', e.uploaded_at
              ) ORDER BY e.uploaded_at) FROM public.student_enrollment_grievance_evidence e
                WHERE e.grievance_id = g.id), '[]'::jsonb) AS evidence,
              COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'id', ev.id, 'actorType', ev.actor_type, 'eventType', ev.event_type,
                'fromStatus', ev.from_status, 'toStatus', ev.to_status,
                'note', ev.note, 'createdAt', ev.created_at
              ) ORDER BY ev.created_at) FROM public.student_enrollment_grievance_events ev
                WHERE ev.grievance_id = g.id), '[]'::jsonb) AS timeline
       FROM public.student_enrollment_grievances g
       JOIN public.institutions i ON i.id = g.institution_id
       JOIN public.users u ON u.id = g.student_user_id
       LEFT JOIN public.student_profiles sp ON sp.user_id = g.student_user_id
       LEFT JOIN public.curricula c ON c.id = sp.curriculum_id
       LEFT JOIN public.programs p ON p.id = c.program_id
       LEFT JOIN public.branches b ON b.id = c.branch_id
       LEFT JOIN public.schemes sc ON sc.id = c.scheme_id
       WHERE ${where.join(" AND ")}
       ORDER BY CASE WHEN g.status IN ('PENDING','IN_REVIEW','NEEDS_INFO') THEN 0 ELSE 1 END,
                g.created_at DESC
       LIMIT 300`,
      values,
    );
    return res.json({ success: true, grievances: result.rows, count: result.rows.length });
  } catch (error) {
    console.error("Department grievance list failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load grievances for your assigned department." });
  }
}

export async function downloadDepartmentGrievanceEvidence(req: AdminAuthenticatedRequest, res: Response) {
  try {
    const scope = await resolveAdminScope(req, res);
    if (!scope) return;
    const values: unknown[] = [req.params.grievanceId, req.params.evidenceId];
    const academicScope = addAcademicScope(scope, values);
    const result = await pool.query(
      `SELECT e.original_filename, e.mime_type, e.file_data
       FROM public.student_enrollment_grievance_evidence e
       JOIN public.student_enrollment_grievances g ON g.id = e.grievance_id
       JOIN public.student_profiles sp ON sp.user_id = g.student_user_id
       JOIN public.curricula c ON c.id = sp.curriculum_id
       WHERE g.id = $1 AND e.id = $2 AND ${academicScope}`,
      values,
    );
    if (!result.rowCount) return res.status(404).json({ success: false, message: "Evidence file not found in your assigned department." });
    const file = result.rows[0];
    const safeName = String(file.original_filename).replace(/[\r\n"\\]/g, "_");
    res.setHeader("Content-Type", file.mime_type);
    res.setHeader("Content-Length", file.file_data.length);
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(file.file_data);
  } catch (error) {
    console.error("Department grievance evidence download failed:", error);
    return res.status(500).json({ success: false, message: "Unable to download this evidence file." });
  }
}

export async function reviewDepartmentEnrollmentGrievance(req: AdminAuthenticatedRequest, res: Response) {
  const status = typeof req.body?.status === "string" ? req.body.status : "";
  const note = typeof req.body?.adminNote === "string" ? req.body.adminNote.trim() : "";
  if (!reviewStatuses.has(status) || note.length < 3 || note.length > 2000) {
    return res.status(400).json({ success: false, message: "Choose a valid review status and provide a reviewer note of 3–2,000 characters." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const scope = await resolveAdminScope(req, res);
    if (!scope) {
      await client.query("ROLLBACK");
      return;
    }
    const values: unknown[] = [req.params.grievanceId];
    const academicScope = addAcademicScope(scope, values);
    const existing = await client.query(
      `SELECT g.id, g.student_user_id AS "studentUserId", g.status
       FROM public.student_enrollment_grievances g
       JOIN public.student_profiles sp ON sp.user_id = g.student_user_id
       JOIN public.curricula c ON c.id = sp.curriculum_id
       WHERE g.id = $1 AND ${academicScope}
         AND g.status IN ('PENDING','IN_REVIEW','NEEDS_INFO')
       FOR UPDATE OF g`,
      values,
    );
    if (!existing.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, message: "This grievance is no longer open or is outside your assigned department." });
    }

    const updated = await client.query(
      `UPDATE public.student_enrollment_grievances
       SET status = $2, admin_note = $3, reviewed_by = $4,
           reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status IN ('PENDING','IN_REVIEW','NEEDS_INFO')
       RETURNING id, status, admin_note AS "adminNote", updated_at AS "updatedAt"`,
      [req.params.grievanceId, status, note, scope.adminId],
    );
    if (!updated.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, message: "Another reviewer has already updated this grievance." });
    }

    await client.query(
      `INSERT INTO public.student_enrollment_grievance_events
       (grievance_id, actor_type, actor_user_id, event_type, note)
       VALUES ($1, 'ADMIN', $2, 'NOTE_ADDED', $3)`,
      [req.params.grievanceId, scope.adminId, note],
    );
    await client.query(
      `INSERT INTO public.student_notifications
       (user_id, notification_type, title, message, action_url)
       VALUES ($1, 'ENROLLMENT_GRIEVANCE', 'Enrollment grievance updated', $2, '/student/notifications')`,
      [existing.rows[0].studentUserId, `Your enrollment grievance status is now ${status.replace(/_/g, " ")}. ${note}`],
    );

    await client.query("COMMIT");
    return res.json({ success: true, message: "Grievance review saved and the student has been notified.", grievance: updated.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Department grievance review failed:", error);
    return res.status(500).json({ success: false, message: "Unable to update this grievance." });
  } finally {
    client.release();
  }
}
