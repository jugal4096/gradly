import type { Response } from "express";
import type { SuperAdminAuthenticatedRequest } from "../../middleware/super-admin-auth.middleware";
import { pool } from "../../config/database";

const openStatuses = ["PENDING", "IN_REVIEW", "NEEDS_INFO"];
const validStatuses = new Set(["IN_REVIEW", "NEEDS_INFO", "RESOLVED", "REJECTED"]);
const MAX_NOTE = 2000;

export async function listSuperAdminEnrollmentGrievanceCenter(req: SuperAdminAuthenticatedRequest, res: Response) {
  if (!req.superAdmin?.superAdminId) return res.status(401).json({ success: false, message: "Super Admin authentication required." });
  const status = typeof req.query.status === "string" ? req.query.status : "ALL";
  if (status !== "ALL" && !["PENDING", "IN_REVIEW", "NEEDS_INFO", "RESOLVED", "REJECTED"].includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid grievance status filter." });
  }
  const values: unknown[] = [];
  const where = status === "ALL" ? "" : (values.push(status), `WHERE g.status = $${values.length}`);
  try {
    const result = await pool.query(
      `SELECT g.id, g.student_user_id AS "studentUserId", g.institution_id AS "institutionId",
              g.enrollment_number AS "enrollmentNumber", g.category, g.description,
              g.proposed_correction AS "proposedCorrection", g.status,
              g.admin_note AS "adminNote", g.created_at AS "createdAt",
              g.updated_at AS "updatedAt", g.reviewed_at AS "reviewedAt",
              i.name AS institution, u.display_name AS "studentName", u.email AS "studentEmail",
              sp.id AS "studentProfileId", sp.student_identifier AS "studentIdentifier",
              sp.admission_year AS "admissionYear", sp.current_semester_number AS "currentSemester",
              sp.academic_status AS "academicStatus", sp.academic_profile_confirmed AS "profileConfirmed",
              sp.admission_mode_id AS "admissionModeId", am.name AS "admissionMode",
              c.id AS "curriculumId", c.version AS "curriculumVersion", c.status AS "curriculumStatus",
              p.id AS "programId", p.name AS programme, b.id AS "branchId", b.name AS branch,
              sc.id AS "schemeId", sc.name AS scheme, sz.id AS "specializationId", sz.name AS specialization,
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
                WHERE ev.grievance_id = g.id), '[]'::jsonb) AS timeline,
              COALESCE((SELECT jsonb_agg(jsonb_build_object('id', cx.id, 'label',
                p2.name || ' · ' || COALESCE(b2.name, 'General') || ' · ' || COALESCE(sc2.name, 'Scheme') || ' · v' || cx.version)
                ORDER BY p2.name, b2.name, cx.version DESC)
                FROM public.curricula cx
                JOIN public.programs p2 ON p2.id = cx.program_id
                LEFT JOIN public.branches b2 ON b2.id = cx.branch_id
                LEFT JOIN public.schemes sc2 ON sc2.id = cx.scheme_id
                WHERE cx.institution_id = g.institution_id), '[]'::jsonb) AS "curriculumOptions",
              COALESCE((SELECT jsonb_agg(jsonb_build_object('id', ax.id, 'label', ax.name || ' · entry semester ' || ax.entry_semester)
                ORDER BY ax.entry_semester, ax.name)
                FROM public.admission_modes ax
                WHERE ax.institution_id = g.institution_id AND ax.active = TRUE), '[]'::jsonb) AS "admissionModeOptions"
       FROM public.student_enrollment_grievances g
       JOIN public.institutions i ON i.id = g.institution_id
       JOIN public.users u ON u.id = g.student_user_id
       LEFT JOIN public.student_profiles sp ON sp.user_id = g.student_user_id
       LEFT JOIN public.curricula c ON c.id = sp.curriculum_id
       LEFT JOIN public.programs p ON p.id = c.program_id
       LEFT JOIN public.branches b ON b.id = c.branch_id
       LEFT JOIN public.schemes sc ON sc.id = c.scheme_id
       LEFT JOIN public.specializations sz ON sz.id = c.specialization_id
       LEFT JOIN public.admission_modes am ON am.id = sp.admission_mode_id
       ${where}
       ORDER BY CASE WHEN g.status IN ('PENDING','IN_REVIEW','NEEDS_INFO') THEN 0 ELSE 1 END,
                g.created_at DESC
       LIMIT 500`,
      values,
    );
    return res.json({ success: true, grievances: result.rows, count: result.rows.length });
  } catch (error) {
    console.error("Super Admin grievance centre list failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load the Super Admin grievance centre." });
  }
}

export async function downloadSuperAdminGrievanceEvidence(req: SuperAdminAuthenticatedRequest, res: Response) {
  if (!req.superAdmin?.superAdminId) return res.status(401).json({ success: false, message: "Super Admin authentication required." });
  try {
    const result = await pool.query(
      `SELECT e.original_filename, e.mime_type, e.file_data
       FROM public.student_enrollment_grievance_evidence e
       JOIN public.student_enrollment_grievances g ON g.id = e.grievance_id
       WHERE g.id = $1 AND e.id = $2`,
      [req.params.grievanceId, req.params.evidenceId],
    );
    if (!result.rowCount) return res.status(404).json({ success: false, message: "Evidence file not found." });
    const file = result.rows[0];
    const safeName = String(file.original_filename).replace(/[\r\n"\\]/g, "_");
    res.setHeader("Content-Type", file.mime_type);
    res.setHeader("Content-Length", file.file_data.length);
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.send(file.file_data);
  } catch (error) {
    console.error("Super Admin grievance evidence download failed:", error);
    return res.status(500).json({ success: false, message: "Unable to download evidence." });
  }
}

type ProfileCorrection = { field?: unknown; value?: unknown };

export async function reviewSuperAdminEnrollmentGrievance(req: SuperAdminAuthenticatedRequest, res: Response) {
  const superAdminId = req.superAdmin?.superAdminId;
  if (!superAdminId) return res.status(401).json({ success: false, message: "Super Admin authentication required." });
  const status = typeof req.body?.status === "string" ? req.body.status : "";
  const note = typeof req.body?.adminNote === "string" ? req.body.adminNote.trim() : "";
  const correction = (req.body?.profileCorrection || {}) as ProfileCorrection;
  const field = typeof correction.field === "string" ? correction.field : "";
  const value = typeof correction.value === "string" ? correction.value.trim() : "";
  const hasCorrection = Boolean(field || value);
  if (!validStatuses.has(status) || note.length < 3 || note.length > MAX_NOTE) {
    return res.status(400).json({ success: false, message: "Choose a valid review status and provide a note of 3–2,000 characters." });
  }
  if (hasCorrection && (status !== "RESOLVED" || !field || !value)) {
    return res.status(400).json({ success: false, message: "An individual academic profile correction requires a field, verified value and RESOLVED decision." });
  }
  if (hasCorrection && !["CURRICULUM", "ADMISSION_MODE", "STUDENT_IDENTIFIER", "ADMISSION_YEAR"].includes(field)) {
    return res.status(400).json({ success: false, message: "Unsupported individual profile correction." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const grievanceResult = await client.query(
      `SELECT id, student_user_id, institution_id, enrollment_number, status
       FROM public.student_enrollment_grievances
       WHERE id = $1 AND status = ANY($2::varchar[])
       FOR UPDATE`,
      [req.params.grievanceId, openStatuses],
    );
    if (!grievanceResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, message: "This grievance is already closed or does not exist." });
    }
    const grievance = grievanceResult.rows[0];
    let correctionAudit = "";
    if (hasCorrection) {
      const profileResult = await client.query(
        `SELECT id, institution_id, curriculum_id, admission_mode_id, student_identifier, admission_year
         FROM public.student_profiles WHERE user_id = $1 FOR UPDATE`,
        [grievance.student_user_id],
      );
      if (!profileResult.rowCount) throw new Error("This student has no confirmed academic profile yet. Request the student to complete Academic Setup before applying an individual correction.");
      const profile = profileResult.rows[0];
      if (String(profile.institution_id) !== String(grievance.institution_id)) throw new Error("The student's academic profile institution does not match this grievance. No correction was applied.");
      let column = "";
      let nextValue: string | number | null = value;
      let previous: unknown;
      if (field === "CURRICULUM") {
        const target = await client.query(
          `SELECT id FROM public.curricula WHERE id = $1 AND institution_id = $2 LIMIT 1`,
          [value, grievance.institution_id],
        );
        if (!target.rowCount) throw new Error("Choose a curriculum that already exists at this student's institution.");
        column = "curriculum_id"; previous = profile.curriculum_id;
      } else if (field === "ADMISSION_MODE") {
        const target = await client.query(
          `SELECT id FROM public.admission_modes WHERE id = $1 AND institution_id = $2 AND active = TRUE LIMIT 1`,
          [value, grievance.institution_id],
        );
        if (!target.rowCount) throw new Error("Choose an active admission mode configured for this student's institution.");
        column = "admission_mode_id"; previous = profile.admission_mode_id;
      } else if (field === "STUDENT_IDENTIFIER") {
        if (value.length < 2 || value.length > 80) throw new Error("Student identifier must contain 2–80 characters.");
        column = "student_identifier"; previous = profile.student_identifier;
      } else if (field === "ADMISSION_YEAR") {
        const year = Number(value);
        const currentYear = new Date().getFullYear();
        if (!/^\d{4}$/.test(value) || year < 1980 || year > currentYear) throw new Error("Enter a valid four-digit admission year.");
        column = "admission_year"; nextValue = year; previous = profile.admission_year;
      }
      await client.query(
        `UPDATE public.student_profiles SET ${column} = $2, updated_at = NOW() WHERE id = $1`,
        [profile.id, nextValue],
      );
      correctionAudit = `Individual academic profile correction: ${field} changed from "${String(previous ?? "—")}" to "${String(nextValue)}".`;
      await client.query(
        `INSERT INTO public.student_enrollment_grievance_events
         (grievance_id, actor_type, actor_user_id, event_type, note)
         VALUES ($1, 'SUPER_ADMIN', NULL, 'NOTE_ADDED', $2)`,
        [grievance.id, correctionAudit],
      );
    }
    const fullNote = correctionAudit ? note + "\n" + correctionAudit : note;
    const updated = await client.query(
      `UPDATE public.student_enrollment_grievances
       SET status = $2, admin_note = $3, reviewed_by = $4,
           reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = ANY($5::varchar[])
       RETURNING id, status, admin_note AS "adminNote", updated_at AS "updatedAt"`,
      [grievance.id, status, fullNote, superAdminId, openStatuses],
    );
    if (!updated.rowCount) throw new Error("Another reviewer has already updated this grievance.");
    await client.query(
      `INSERT INTO public.student_enrollment_grievance_events
       (grievance_id, actor_type, actor_user_id, event_type, note)
       VALUES ($1, 'SUPER_ADMIN', NULL, 'NOTE_ADDED', $2)`,
      [grievance.id, note],
    );
    await client.query(
      `INSERT INTO public.student_notifications
       (user_id, notification_type, title, message, action_url)
       VALUES ($1, 'ENROLLMENT_GRIEVANCE', 'Academic grievance reviewed', $2, '/student/notifications')`,
      [grievance.student_user_id, `Your academic grievance status is now ${status.replace(/_/g, " ")}. ${note}${correctionAudit ? " " + correctionAudit : ""}`],
    );
    await client.query("COMMIT");
    return res.json({ success: true, message: "Grievance reviewed. The student has been notified.", grievance: updated.rows[0], profileCorrectionApplied: hasCorrection });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    const message = error instanceof Error ? error.message : "Unable to review this grievance.";
    if (message.startsWith("This student") || message.startsWith("The student's academic profile") || message.startsWith("Choose") || message.startsWith("Student identifier") || message.startsWith("Enter") || message.startsWith("Another")) {
      return res.status(400).json({ success: false, message });
    }
    console.error("Super Admin grievance review failed:", error);
    return res.status(500).json({ success: false, message: "Unable to review this grievance." });
  } finally {
    client.release();
  }
}
