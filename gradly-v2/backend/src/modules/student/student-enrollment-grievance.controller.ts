import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";
import type { AdminAuthenticatedRequest } from "../../middleware/admin-auth.middleware";
import type { SuperAdminAuthenticatedRequest } from "../../middleware/super-admin-auth.middleware";
import { pool } from "../../config/database";
import { getGradlyUserByFirebaseUid } from "../auth/auth.service";
import { isAllowedSchemeForEnrollmentPrefix, parseEnrollmentNumber } from "../academic/enrollment-progression";

const categories = new Set(["INVALID_ENROLLMENT", "ALREADY_REGISTERED", "WRONG_PROGRAMME", "WRONG_SCHEME", "WRONG_BRANCH", "WRONG_SPECIALIZATION", "WRONG_ADMISSION_MODE", "WRONG_SEMESTER", "OTHER"]);
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
  const proposedCorrection = typeof req.body?.proposedCorrection === "string" ? req.body.proposedCorrection.trim() : "";
  if (!institutionId || !categories.has(category) || proposedCorrection.length < 2 || proposedCorrection.length > 500 || description.length < 10 || description.length > 3000) {
    return res.status(400).json({ success:false, message:"Select an issue category, state the requested correction (2–500 characters), and explain the reason (10–3,000 characters)." });
  }
  if (enrollment && enrollment.length > 32) return res.status(400).json({ success:false, message:"Enrollment number is too long." });
  try {
    const duplicate = await pool.query(
      `SELECT id FROM public.student_enrollment_grievances
       WHERE student_user_id = $1 AND institution_id = $2
         AND COALESCE(enrollment_number, '') = $3 AND category = $4
         AND status IN ('PENDING','IN_REVIEW','NEEDS_INFO')
       ORDER BY created_at DESC LIMIT 1`,
      [user.id, institutionId, enrollment, category],
    );
    if (duplicate.rowCount) return res.status(409).json({ success:false, code:"GRIEVANCE_ALREADY_OPEN", message:"You already have an open grievance for this issue. Check your grievance history for its status." });
    const result = await pool.query(
      `INSERT INTO public.student_enrollment_grievances
       (student_user_id, institution_id, enrollment_number, category, description, proposed_correction)
       VALUES ($1,$2,NULLIF($3,''),$4,$5,$6)
       RETURNING id, category, description, proposed_correction AS "proposedCorrection", status, created_at AS "createdAt"`,
      [user.id, institutionId, enrollment, category, description, proposedCorrection],
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
      `SELECT g.id, g.category, g.description, g.proposed_correction AS "proposedCorrection",
              g.status, g.admin_note AS "adminNote", g.created_at AS "createdAt",
              g.updated_at AS "updatedAt", g.reviewed_at AS "reviewedAt",
              COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'id', e.id, 'fileName', e.original_filename, 'mimeType', e.mime_type,
                'fileSize', e.file_size, 'uploadedAt', e.uploaded_at
              ) ORDER BY e.uploaded_at) FROM public.student_enrollment_grievance_evidence e
                WHERE e.grievance_id = g.id AND e.student_user_id = $1), '[]'::jsonb) AS evidence,
              COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'id', ev.id, 'eventType', ev.event_type, 'fromStatus', ev.from_status,
                'toStatus', ev.to_status, 'note', ev.note, 'createdAt', ev.created_at
              ) ORDER BY ev.created_at) FROM public.student_enrollment_grievance_events ev
                WHERE ev.grievance_id = g.id), '[]'::jsonb) AS timeline
       FROM public.student_enrollment_grievances g
       WHERE g.student_user_id = $1 ORDER BY g.created_at DESC LIMIT 100`,
      [user.id],
    );
    return res.json({ success:true, grievances:result.rows });
  } catch (error) {
    console.error("Student grievance tracking failed:", error);
    return res.status(500).json({ success:false, message:"Unable to load your enrollment grievances." });
  }
}



const MAX_EVIDENCE_BYTES = 3 * 1024 * 1024;
const allowedEvidenceTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);

function decodeEvidence(dataUrl: unknown, mimeType: unknown) {
  if (typeof dataUrl !== "string" || typeof mimeType !== "string" || !allowedEvidenceTypes.has(mimeType)) return null;
  const match = /^data:(application\/pdf|image\/jpeg|image\/png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match || match[1] !== mimeType) return null;
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_EVIDENCE_BYTES || buffer.toString("base64") !== match[2]) return null;
  const valid = mimeType === "application/pdf"
    ? buffer.subarray(0, 5).toString("ascii") === "%PDF-"
    : mimeType === "image/png"
      ? buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  return valid ? buffer : null;
}

export async function uploadEnrollmentGrievanceEvidence(req: AuthenticatedRequest, res: Response) {
  const user = await studentUser(req, res); if (!user) return;
  const grievanceId = req.params.grievanceId;
  const fileName = typeof req.body?.fileName === "string" ? req.body.fileName.trim().replace(/[\\/\\\\]/g, "_").slice(0, 180) : "";
  const mimeType = req.body?.mimeType;
  const buffer = decodeEvidence(req.body?.dataUrl, mimeType);
  if (!fileName || !buffer) return res.status(400).json({ success:false, message:"Upload a valid PDF, JPG or PNG file up to 3 MB." });
  try {
    const owned = await pool.query(
      `SELECT id FROM public.student_enrollment_grievances
       WHERE id = $1 AND student_user_id = $2`, [grievanceId, user.id],
    );
    if (!owned.rowCount) return res.status(404).json({ success:false, message:"Grievance not found." });
    const count = await pool.query(
      `SELECT COUNT(*)::int AS count FROM public.student_enrollment_grievance_evidence
       WHERE grievance_id = $1 AND student_user_id = $2`, [grievanceId, user.id],
    );
    if (count.rows[0].count >= 5) return res.status(409).json({ success:false, message:"A maximum of five evidence files is allowed per grievance." });
    const result = await pool.query(
      `INSERT INTO public.student_enrollment_grievance_evidence
       (grievance_id, student_user_id, original_filename, mime_type, file_size, file_data)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, original_filename AS "fileName", mime_type AS "mimeType", file_size AS "fileSize", uploaded_at AS "uploadedAt"`,
      [grievanceId, user.id, fileName, mimeType, buffer.length, buffer],
    );
    await pool.query(
      `INSERT INTO public.student_enrollment_grievance_events
       (grievance_id, actor_type, actor_user_id, event_type, note)
       VALUES ($1,'STUDENT',$2,'EVIDENCE_UPLOADED',$3)`,
      [grievanceId, user.id, `Evidence uploaded: ${fileName}`],
    );
    return res.status(201).json({ success:true, evidence:result.rows[0] });
  } catch (error) {
    console.error("Enrollment grievance evidence upload failed:", error);
    return res.status(500).json({ success:false, message:"Unable to upload evidence. Please try again." });
  }
}

export async function downloadEnrollmentGrievanceEvidence(req: AuthenticatedRequest, res: Response) {
  const user = await studentUser(req, res); if (!user) return;
  try {
    const result = await pool.query(
      `SELECT e.original_filename, e.mime_type, e.file_data
       FROM public.student_enrollment_grievance_evidence e
       JOIN public.student_enrollment_grievances g ON g.id = e.grievance_id
       WHERE e.id = $1 AND e.grievance_id = $2 AND e.student_user_id = $3
         AND g.student_user_id = $3`,
      [req.params.evidenceId, req.params.grievanceId, user.id],
    );
    if (!result.rowCount) return res.status(404).json({ success:false, message:"Evidence file not found." });
    const file = result.rows[0];
    const safeName = String(file.original_filename).replace(/[\\r\\n"\\\\]/g, "_");
    res.setHeader("Content-Type", file.mime_type);
    res.setHeader("Content-Length", file.file_data.length);
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    res.setHeader("Cache-Control", "private, no-store");
    return res.send(file.file_data);
  } catch (error) {
    console.error("Enrollment grievance evidence download failed:", error);
    return res.status(500).json({ success:false, message:"Unable to download evidence." });
  }
}

export async function listEnrollmentGrievancesForAdmin(req: AdminAuthenticatedRequest, res: Response) {
  const institutionId = req.admin?.institutionId;
  if (!req.admin?.adminId) return res.status(401).json({ success:false, message:"Admin authentication required." });
  if (!institutionId) return res.status(403).json({ success:false, message:"This Admin account is not assigned to an institution." });
  try {
    const result = await pool.query(
      `SELECT g.id, g.enrollment_number AS "enrollmentNumber", g.category, g.description, g.proposed_correction AS "proposedCorrection",
              g.status, g.admin_note AS "adminNote", g.created_at AS "createdAt",
              g.updated_at AS "updatedAt"
       FROM public.student_enrollment_grievances g
       WHERE g.institution_id = $1
       ORDER BY CASE WHEN g.status IN ('PENDING','IN_REVIEW','NEEDS_INFO') THEN 0 ELSE 1 END,
                g.created_at DESC
       LIMIT 300`,
      [institutionId],
    );
    return res.json({ success:true, grievances:result.rows });
  } catch (error) {
    console.error("Institution Admin grievance list failed:", error);
    return res.status(500).json({ success:false, message:"Unable to load enrollment grievances for this institution." });
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
              g.category, g.description, g.proposed_correction AS "proposedCorrection", g.status, g.admin_note AS "adminNote",
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

class MappingCorrectionError extends Error {}

export async function reviewEnrollmentGrievance(req: SuperAdminAuthenticatedRequest, res: Response) {
  const superAdminId = req.superAdmin?.superAdminId;
  if (!superAdminId) return res.status(401).json({ success:false, message:"Super Admin authentication required." });
  const status = req.body?.status;
  const note = typeof req.body?.adminNote === "string" ? req.body.adminNote.trim() : "";
  const correctionType = typeof req.body?.correctionType === "string" ? req.body.correctionType : "";
  const correctionValue = typeof req.body?.correctionValue === "string" ? req.body.correctionValue.trim() : "";
  const requestedEntrySemester = Number(req.body?.correctionEntrySemester);
  if (typeof status !== "string" || !reviewStatuses.has(status) || note.length < 3 || note.length > 2000) {
    return res.status(400).json({ success:false, message:"Choose a valid review status and provide an admin note of 3–2,000 characters." });
  }
  if (correctionType && !["PROGRAMME","BRANCH","SCHEME","ADMISSION_MODE"].includes(correctionType)) {
    return res.status(400).json({ success:false, message:"Unsupported enrollment mapping correction." });
  }
  if (correctionType && (status !== "RESOLVED" || correctionValue.length < 2 || correctionValue.length > 160)) {
    return res.status(400).json({ success:false, message:"A mapping correction requires a valid correction value and the RESOLVED decision." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT id, institution_id, enrollment_number FROM public.student_enrollment_grievances
       WHERE id = $1 AND status IN ('PENDING','IN_REVIEW','NEEDS_INFO') FOR UPDATE`,
      [req.params.grievanceId],
    );
    if (!existing.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success:false, message:"Open enrollment grievance not found." });
    }

    if (correctionType) {
      const grievance = existing.rows[0];
      if (!grievance.enrollment_number) throw new MappingCorrectionError("The grievance has no enrollment number to map.");
      let parsed;
      try { parsed = parseEnrollmentNumber(String(grievance.enrollment_number)); }
      catch { throw new MappingCorrectionError("The enrollment number is not structurally valid. Resolve the student's source record before changing a mapping."); }

      if (correctionType === "BRANCH") {
        const branch = await client.query(
          `SELECT b.name, p.name AS program_name
           FROM public.branches b JOIN public.programs p ON p.id = b.program_id
           WHERE p.institution_id = $1 AND LOWER(b.name) = LOWER($2)
             AND EXISTS (
               SELECT 1 FROM public.enrollment_program_rules r
               WHERE r.prefix = $3 AND (r.institution_id = $1 OR r.institution_id IS NULL)
                 AND (p.name ILIKE r.programme_name_pattern
                   OR (r.programme_alternate_pattern IS NOT NULL AND p.name ILIKE r.programme_alternate_pattern)
                   OR p.name ILIKE ANY(r.programme_alias_patterns))
             )
           LIMIT 1`,
          [grievance.institution_id, correctionValue, parsed.prefix],
        );
        if (!branch.rowCount) throw new MappingCorrectionError("Choose an existing branch under the detected degree programme at this institution.");
        await client.query(
          `INSERT INTO public.enrollment_branch_codes
           (institution_id, branch_code, programme_prefix, branch_name, program_name_pattern)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (institution_id, branch_code, programme_prefix)
           DO UPDATE SET branch_name = EXCLUDED.branch_name, program_name_pattern = EXCLUDED.program_name_pattern`,
          [grievance.institution_id, parsed.branchCode, parsed.prefix, branch.rows[0].name, "%" + branch.rows[0].program_name + "%"],
        );
      } else if (correctionType === "SCHEME") {
        const scheme = await client.query("SELECT name FROM public.schemes WHERE LOWER(name) = LOWER($1) LIMIT 1", [correctionValue]);
        if (!scheme.rowCount || !isAllowedSchemeForEnrollmentPrefix(parsed.prefix, scheme.rows[0].name)) {
          throw new MappingCorrectionError(parsed.prefix === "BE" ? "BE enrollment mappings must resolve to New CBCS." : parsed.prefix === "BT" ? "BT enrollment mappings must resolve to NEP." : "Choose a valid scheme configured for this programme.");
        }
        const correctedSchemeRule = await client.query(
          `INSERT INTO public.enrollment_program_rules
           (institution_id, prefix, programme_name_pattern, programme_alternate_pattern, programme_alias_patterns,
            scheme_label, duration_years, total_semesters, regular_entry_semester, lateral_entry_semester, year_pivot_start)
           SELECT $1, prefix, programme_name_pattern, programme_alternate_pattern, programme_alias_patterns,
                  $3, duration_years, total_semesters, regular_entry_semester, lateral_entry_semester, year_pivot_start
           FROM public.enrollment_program_rules
           WHERE prefix = $2 AND (institution_id = $1 OR institution_id IS NULL)
           ORDER BY (institution_id = $1) DESC NULLS LAST LIMIT 1
           ON CONFLICT (institution_id, prefix) DO UPDATE SET scheme_label = EXCLUDED.scheme_label`,
          [grievance.institution_id, parsed.prefix, scheme.rows[0].name],
        );
        if (!correctedSchemeRule.rowCount) throw new MappingCorrectionError("No programme rule exists to receive the scheme correction.");
      } else if (correctionType === "ADMISSION_MODE") {
        const entrySemester = Number.isInteger(requestedEntrySemester) && requestedEntrySemester >= 1 && requestedEntrySemester <= 20
          ? requestedEntrySemester : parsed.admissionModeCode === "S" ? 3 : 1;
        await client.query(
          `INSERT INTO public.enrollment_admission_modes
           (institution_id, mode_code, programme_prefix, mode_name, entry_semester)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (institution_id, mode_code, programme_prefix)
           DO UPDATE SET mode_name = EXCLUDED.mode_name, entry_semester = EXCLUDED.entry_semester`,
          [grievance.institution_id, parsed.admissionModeCode, parsed.prefix, correctionValue, entrySemester],
        );
      } else if (correctionType === "PROGRAMME") {
        const program = await client.query(
          "SELECT name FROM public.programs WHERE institution_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1",
          [grievance.institution_id, correctionValue],
        );
        if (!program.rowCount) throw new MappingCorrectionError("Choose an existing programme at the selected institution.");
        const programName = String(program.rows[0].name);
        const prefixPatterns: Record<string,RegExp> = {
          BE:/bachelor\s+of\s+engineering|\bb\.?e\.?\b/i,
          BT:/bachelor\s+of\s+technology|\bb\.?tech\.?\b/i,
          MC:/master\s+of\s+computer\s+applications|\bmca\b/i,
          MT:/master\s+of\s+technology|\bm\.?tech\.?\b/i,
        };
        if (!prefixPatterns[parsed.prefix]?.test(programName)) throw new MappingCorrectionError("The programme name does not match the degree prefix in this enrollment number.");
        const correctedProgrammeRule = await client.query(
          `INSERT INTO public.enrollment_program_rules
           (institution_id, prefix, programme_name_pattern, programme_alternate_pattern, programme_alias_patterns,
            scheme_label, duration_years, total_semesters, regular_entry_semester, lateral_entry_semester, year_pivot_start)
           SELECT $1, prefix, $3, NULL, '{}'::text[], scheme_label, duration_years, total_semesters,
                  regular_entry_semester, lateral_entry_semester, year_pivot_start
           FROM public.enrollment_program_rules
           WHERE prefix = $2 AND (institution_id = $1 OR institution_id IS NULL)
           ORDER BY (institution_id = $1) DESC NULLS LAST LIMIT 1
           ON CONFLICT (institution_id, prefix) DO UPDATE
           SET programme_name_pattern = EXCLUDED.programme_name_pattern,
               programme_alternate_pattern = NULL, programme_alias_patterns = '{}'::text[]`,
          [grievance.institution_id, parsed.prefix, "%" + programName + "%"],
        );
        if (!correctedProgrammeRule.rowCount) throw new MappingCorrectionError("No programme rule exists to receive the programme correction.");
      }
    }

    const result = await client.query(
      `UPDATE public.student_enrollment_grievances
       SET status = $2, admin_note = $3, reviewed_by = $4, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING id, status, admin_note AS "adminNote", updated_at AS "updatedAt"`,
      [req.params.grievanceId, status, note, superAdminId],
    );
    await client.query(
      `INSERT INTO public.student_notifications (user_id, notification_type, title, message, action_url)
       SELECT student_user_id, 'ENROLLMENT_GRIEVANCE', 'Enrollment grievance updated',
              $2, '/student/notifications'
       FROM public.student_enrollment_grievances WHERE id = $1`,
      [req.params.grievanceId, `Your enrollment grievance status is now ${status.replace(/_/g, " ")}. ${note}`],
    );
    await client.query("COMMIT");
    return res.json({ success:true, message:"Enrollment grievance reviewed. Any approved mapping correction is now active, and the student has been notified.", grievance:result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (error instanceof MappingCorrectionError) return res.status(400).json({ success:false, message:error.message });
    console.error("Enrollment grievance review failed:", error);
    return res.status(500).json({ success:false, message:"Unable to update enrollment grievance." });
  } finally {
    client.release();
  }
}
