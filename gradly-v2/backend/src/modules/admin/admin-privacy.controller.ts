import type { Response } from "express";
import { pool } from "../../config/database";
import type { AdminAuthenticatedRequest } from "../../middleware/admin-auth.middleware";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { getGradlyUserByFirebaseUid } from "../auth/auth.service";

export async function getAdminPrivacyActivity(req: AdminAuthenticatedRequest, res: Response) {
  const admin = req.admin;
  if (!admin?.adminId || !admin.institutionId || !admin.programId || !admin.branchId) {
    return res.status(403).json({ success: false, message: "A complete department assignment is required." });
  }
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM public.admin_active_user_sessions
          WHERE institution_id = $1 AND program_id = $2 AND branch_id = $3
            AND last_seen_at >= NOW() - INTERVAL '5 minutes') AS "loggedInUsers",
        (SELECT COUNT(*)::int FROM public.guest_sessions
          WHERE last_seen_at >= NOW() - INTERVAL '5 minutes'
            AND metadata->>'branch_id' = $3::text) AS "guestUsers"
    `, [admin.institutionId, admin.programId, admin.branchId]);
    return res.json({ success: true, activeWindowMinutes: 5, counts: result.rows[0] });
  } catch (error) {
    console.error("Admin privacy activity count failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load anonymous activity counts. Confirm the privacy activity migration has been applied." });
  }
}

export async function listDepartmentSyllabusFeedback(req: AdminAuthenticatedRequest, res: Response) {
  const admin = req.admin;
  if (!admin?.adminId || !admin.institutionId || !admin.programId || !admin.branchId) {
    return res.status(403).json({ success: false, message: "A complete department assignment is required." });
  }
  try {
    const status = typeof req.query.status === "string" ? req.query.status.toUpperCase() : "ALL";
    const values: unknown[] = [admin.institutionId, admin.programId, admin.branchId];
    let statusFilter = "";
    if (["PENDING","REVIEWED","FORWARDED","RESOLVED","REJECTED"].includes(status)) {
      values.push(status);
      statusFilter = " AND status = $4";
    }
    const result = await pool.query(`
      SELECT id, scheme_name AS "schemeName", semester_number AS "semesterNumber",
        subject_name AS "subjectName", request_type AS "requestType", message,
        status, admin_review_note AS "adminReviewNote", reviewed_at AS "reviewedAt",
        created_at AS "createdAt"
      FROM public.student_syllabus_feedback
      WHERE institution_id = $1 AND program_id = $2 AND branch_id = $3 ${statusFilter}
      ORDER BY created_at DESC LIMIT 200
    `, values);
    return res.json({ success: true, feedback: result.rows });
  } catch (error) {
    console.error("Department syllabus feedback load failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load syllabus feedback. Confirm the privacy activity migration has been applied." });
  }
}

export async function reviewDepartmentSyllabusFeedback(req: AdminAuthenticatedRequest, res: Response) {
  const admin = req.admin;
  if (!admin?.adminId || !admin.institutionId || !admin.programId || !admin.branchId) {
    return res.status(403).json({ success: false, message: "A complete department assignment is required." });
  }
  const status = typeof req.body?.status === "string" ? req.body.status.toUpperCase() : "";
  const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";
  if (!["REVIEWED","FORWARDED"].includes(status)) {
    return res.status(400).json({ success: false, message: "Choose REVIEWED or FORWARDED. Only Super Admin can approve curriculum changes." });
  }
  if (note.length > 1000) return res.status(400).json({ success: false, message: "Review note must be 1,000 characters or fewer." });
  try {
    const result = await pool.query(`
      UPDATE public.student_syllabus_feedback
      SET status = $1, admin_review_note = NULLIF($2, ''),
          reviewed_by_admin_id = $3, reviewed_at = NOW()
      WHERE id = $4 AND institution_id = $5 AND program_id = $6 AND branch_id = $7
      RETURNING id, status, admin_review_note AS "adminReviewNote", reviewed_at AS "reviewedAt"
    `, [status, note, admin.adminId, req.params.feedbackId, admin.institutionId, admin.programId, admin.branchId]);
    if (!result.rowCount) return res.status(404).json({ success: false, message: "Feedback not found in your assigned department." });
    return res.json({ success: true, feedback: result.rows[0] });
  } catch (error) {
    console.error("Department syllabus feedback review failed:", error);
    return res.status(500).json({ success: false, message: "Unable to update feedback status." });
  }
}

export async function submitStudentSyllabusFeedback(req: AuthenticatedRequest, res: Response) {
  if (!req.firebaseUser?.uid) return res.status(401).json({ success: false, message: "Student authentication required." });
  const { requestType, message, subjectName, semesterNumber } = req.body ?? {};
  const allowedTypes = ["SYLLABUS_CHANGE","SYLLABUS_FEEDBACK","MISSING_SUBJECT","CREDIT_CORRECTION","OTHER"];
  if (typeof requestType !== "string" || !allowedTypes.includes(requestType)) return res.status(400).json({ success: false, message: "Choose a valid feedback type." });
  if (typeof message !== "string" || message.trim().length < 10 || message.trim().length > 3000) return res.status(400).json({ success: false, message: "Message must be between 10 and 3,000 characters." });
  const semester = semesterNumber === undefined || semesterNumber === null || semesterNumber === "" ? null : Number(semesterNumber);
  if (semester !== null && (!Number.isInteger(semester) || semester < 1 || semester > 20)) return res.status(400).json({ success: false, message: "Semester must be between 1 and 20." });
  try {
    const user = await getGradlyUserByFirebaseUid(req.firebaseUser.uid);
    if (!user?.id) return res.status(404).json({ success: false, message: "Gradly account not found. Please sync your account and try again." });
    const profile = await pool.query(`
      SELECT sp.institution_id AS "institutionId", sp.curriculum_id AS "curriculumId",
        c.program_id AS "programId", c.branch_id AS "branchId", s.name AS "schemeName"
      FROM public.student_profiles sp
      JOIN public.curricula c ON c.id = sp.curriculum_id
      LEFT JOIN public.schemes s ON s.id = c.scheme_id
      WHERE sp.user_id = $1 LIMIT 1
    `, [user.id]);
    if (!profile.rowCount) return res.status(400).json({ success: false, message: "Complete your academic profile before submitting syllabus feedback." });
    const p = profile.rows[0];
    const result = await pool.query(`
      INSERT INTO public.student_syllabus_feedback
        (submitted_by_user_id, institution_id, program_id, branch_id, curriculum_id,
         scheme_name, semester_number, subject_name, request_type, message)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id, status, created_at AS "createdAt"
    `, [user.id, p.institutionId, p.programId, p.branchId, p.curriculumId, p.schemeName,
      semester, typeof subjectName === "string" ? subjectName.trim().slice(0,180) || null : null,
      requestType, message.trim()]);
    return res.status(201).json({ success: true, message: "Your syllabus feedback has been submitted for department review.", feedback: result.rows[0] });
  } catch (error) {
    console.error("Student syllabus feedback submission failed:", error);
    return res.status(500).json({ success: false, message: "Unable to submit syllabus feedback." });
  }
}

/** Activity tracking hook for authenticated API requests. */
export async function recordAuthenticatedActivity(firebaseUid: string) {
  await pool.query(`
    INSERT INTO public.admin_active_user_sessions (user_id, institution_id, program_id, branch_id, last_seen_at)
    SELECT u.id, sp.institution_id, c.program_id, c.branch_id, NOW()
    FROM public.users u
    JOIN public.student_profiles sp ON sp.user_id = u.id
    JOIN public.curricula c ON c.id = sp.curriculum_id
    WHERE u.firebase_uid = $1 AND u.active = TRUE AND UPPER(COALESCE(u.role, 'STUDENT')) = 'STUDENT'
    ON CONFLICT (user_id) DO UPDATE SET
      institution_id = EXCLUDED.institution_id, program_id = EXCLUDED.program_id,
      branch_id = EXCLUDED.branch_id, last_seen_at = NOW()
  `, [firebaseUid]);
}

export async function listForwardedStudentSyllabusFeedback(req: import("express").Request, res: Response) {
  const superAdminId = (req as any).superAdmin?.superAdminId;
  if (!superAdminId) return res.status(401).json({ success: false, message: "Super Admin authentication required." });
  try {
    const result = await pool.query(`
      SELECT f.id, f.scheme_name AS "schemeName", f.semester_number AS "semesterNumber",
        f.subject_name AS "subjectName", f.request_type AS "requestType", f.message,
        f.status, f.admin_review_note AS "adminReviewNote", f.created_at AS "createdAt",
        i.name AS "institutionName", p.name AS "programName", b.name AS "branchName"
      FROM public.student_syllabus_feedback f
      JOIN public.institutions i ON i.id = f.institution_id
      LEFT JOIN public.programs p ON p.id = f.program_id
      LEFT JOIN public.branches b ON b.id = f.branch_id
      WHERE f.status = 'FORWARDED'
      ORDER BY f.created_at DESC LIMIT 300
    `);
    return res.json({ success: true, feedback: result.rows });
  } catch (error) {
    console.error("Super Admin forwarded syllabus feedback load failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load forwarded student syllabus feedback." });
  }
}
