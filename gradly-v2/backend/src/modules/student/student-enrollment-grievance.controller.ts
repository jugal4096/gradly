import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";
import type { SuperAdminAuthenticatedRequest } from "../../middleware/super-admin-auth.middleware";
import { pool } from "../../config/database";
import { getGradlyUserByFirebaseUid } from "../auth/auth.service";

const categories = new Set(["INVALID_ENROLLMENT", "ALREADY_REGISTERED", "WRONG_PROGRAMME", "WRONG_SCHEME", "WRONG_BRANCH", "WRONG_ADMISSION_MODE", "WRONG_SEMESTER", "OTHER"]);
const reviewStatuses = new Set(["IN_REVIEW", "NEEDS_INFO", "RESOLVED", "REJECTED"]);

async function studentUser(req: AuthenticatedRequest, res: Response) {
  if (!req.firebaseUser?.uid) { res.status(401).json({ success:false, message:"Authentication required." }); return null; }
  const user = await getGradlyUserByFirebaseUid(req.firebaseUser.uid);
  if (!user) { res.status(404).json({ success:false, message:"Gradly account was not found." }); return null; }
  return user;
}

export async function submitEnrollmentGrievance(req: AuthenticatedRequest, res: Response) {
  const user = await studentUser(req, res); if (!user) return;
  const institutionId = typeof req.body?.institutionId === "string" ? req.body.institutionId : "";
  const enrollment = typeof req.body?.enrollmentNumber === "string" ? req.body.enrollmentNumber.trim().toUpperCase() : "";
  const category = typeof req.body?.category === "string" ? req.body.category : "";
  const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
  if (!institutionId || !categories.has(category) || description.length < 10 || description.length > 3000) {
    return res.status(400).json({ success:false, message:"Select an issue category and provide a description of 10–3,000 characters." });
  }
  if (enrollment && enrollment.length > 32) return res.status(400).json({ success:false, message:"Enrollment number is too long." });
  try {
    const result = await pool.query(
      `INSERT INTO public.student_enrollment_grievances
       (student_user_id, institution_id, enrollment_number, category, description)
       VALUES ($1,$2,NULLIF($3,''),$4,$5)
       RETURNING id, category, description, status, created_at AS "createdAt"`,
      [user.id, institutionId, enrollment, category, description],
    );
    return res.status(201).json({ success:true, message:"Your enrollment grievance has been submitted.", grievance:result.rows[0] });
  } catch (error) {
    console.error("Enrollment grievance submission failed:", error);
    return res.status(500).json({ success:false, message:"Unable to submit your grievance. Please try again." });
  }
}

export async function listMyEnrollmentGrievances(req: AuthenticatedRequest, res: Response) {
  const user = await studentUser(req, res); if (!user) return;
  try {
    const result = await pool.query(
      `SELECT id, category, description, status, admin_note AS "adminNote",
              created_at AS "createdAt", updated_at AS "updatedAt", reviewed_at AS "reviewedAt"
       FROM public.student_enrollment_grievances
       WHERE student_user_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [user.id],
    );
    return res.json({ success:true, grievances:result.rows });
  } catch (error) {
    console.error("Student grievance tracking failed:", error);
    return res.status(500).json({ success:false, message:"Unable to load your enrollment grievances." });
  }
}

export async function listEnrollmentGrievancesForSuperAdmin(req: SuperAdminAuthenticatedRequest, res: Response) {
  if (!req.superAdmin?.superAdminId) return res.status(401).json({ success:false, message:"Super Admin authentication required." });
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const values: unknown[] = [];
  const where: string[] = [];
  if (status && status !== "ALL") { values.push(status); where.push(`g.status = $${values.length}`); }
  try {
    const result = await pool.query(
      `SELECT g.id, g.student_user_id AS "studentUserId", g.enrollment_number AS "enrollmentNumber",
              g.category, g.description, g.status, g.admin_note AS "adminNote",
              g.created_at AS "createdAt", g.updated_at AS "updatedAt",
              i.name AS institution, to_jsonb(u)->>'email' AS "studentEmail",
              to_jsonb(u)->>'display_name' AS "studentName"
       FROM public.student_enrollment_grievances g
       JOIN public.institutions i ON i.id = g.institution_id
       JOIN public.users u ON u.id = g.student_user_id
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY CASE WHEN g.status IN ('PENDING','IN_REVIEW','NEEDS_INFO') THEN 0 ELSE 1 END, g.created_at DESC LIMIT 500`,
      values,
    );
    return res.json({ success:true, grievances:result.rows });
  } catch (error) {
    console.error("Super Admin grievance list failed:", error);
    return res.status(500).json({ success:false, message:"Unable to load student enrollment grievances." });
  }
}

export async function reviewEnrollmentGrievance(req: SuperAdminAuthenticatedRequest, res: Response) {
  const superAdminId = req.superAdmin?.superAdminId;
  if (!superAdminId) return res.status(401).json({ success:false, message:"Super Admin authentication required." });
  const status = req.body?.status;
  const note = typeof req.body?.adminNote === "string" ? req.body.adminNote.trim() : "";
  if (typeof status !== "string" || !reviewStatuses.has(status) || note.length < 3 || note.length > 2000) {
    return res.status(400).json({ success:false, message:"Choose a valid review status and provide an admin note of 3–2,000 characters." });
  }
  try {
    const result = await pool.query(
      `UPDATE public.student_enrollment_grievances
       SET status = $2, admin_note = $3, reviewed_by = $4, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status IN ('PENDING','IN_REVIEW','NEEDS_INFO')
       RETURNING id, status, admin_note AS "adminNote", updated_at AS "updatedAt"`,
      [req.params.grievanceId, status, note, superAdminId],
    );
    if (!result.rowCount) return res.status(404).json({ success:false, message:"Open enrollment grievance not found." });
    const grievance = result.rows[0];
    await pool.query(
      `INSERT INTO public.student_notifications (user_id, notification_type, title, message, action_url)
       SELECT student_user_id, 'ENROLLMENT_GRIEVANCE', 'Enrollment grievance updated',
              $2, '/student/notifications'
       FROM public.student_enrollment_grievances WHERE id = $1`,
      [req.params.grievanceId, `Your enrollment grievance status is now ${status.replace(/_/g, " ")}. ${note}`],
    );
    return res.json({ success:true, message:"Enrollment grievance updated and the student has been notified.", grievance });
  } catch (error) {
    console.error("Enrollment grievance review failed:", error);
    return res.status(500).json({ success:false, message:"Unable to update enrollment grievance." });
  }
}
