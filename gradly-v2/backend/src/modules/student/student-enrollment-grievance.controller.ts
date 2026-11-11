import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";
import type { AdminAuthenticatedRequest } from "../../middleware/admin-auth.middleware";
import type { SuperAdminAuthenticatedRequest } from "../../middleware/super-admin-auth.middleware";
import { pool } from "../../config/database";
import { getGradlyUserByFirebaseUid } from "../auth/auth.service";
import { isAllowedSchemeForEnrollmentPrefix, parseEnrollmentNumber } from "../academic/enrollment-progression";
import { buildEnrollmentGrievanceAuditQuery } from "../academic/enrollment-grievance-audit-query";

const categories = new Set(["INVALID_ENROLLMENT", "ALREADY_REGISTERED", "WRONG_PROGRAMME", "WRONG_SCHEME", "WRONG_BRANCH", "WRONG_ADMISSION_MODE", "WRONG_SEMESTER", "OTHER"]);
const reviewStatuses = new Set(["IN_REVIEW", "NEEDS_INFO", "RESOLVED", "REJECTED"]);

async function studentUser(req: AuthenticatedRequest, res: Response) {
  if (!req.firebaseUser?.uid) { res.status(401).json({ success:false, message:"Authentication required." }); return null; }
  const user = await getGradlyUserByFirebaseUid(req.firebaseUser.uid);
  if (!user) { res.status(404).json({ success:false, message:"Gradly account was not found." }); return null; }
  return user;
}

function decodeEvidence(body: Record<string, unknown>) {
  const raw = typeof body.attachmentBase64 === "string" ? body.attachmentBase64 : "";
  if (!raw) return null;
  const name = typeof body.attachmentName === "string" ? body.attachmentName.trim().replaceAll("/", "_").replaceAll("\\", "_").replace(/[\r\n\0]/g, "_").slice(0, 255) : "";
  const mime = typeof body.attachmentType === "string" ? body.attachmentType.toLowerCase() : "";
  if (!name || !["application/pdf", "image/jpeg", "image/png"].includes(mime)) {
    throw new Error("Attach a PDF, JPG or PNG document.");
  }
  const base64 = raw.replace(/^data:[^;]+;base64,/, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length % 4 !== 0) throw new Error("The selected document could not be read.");
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) throw new Error("The attachment must be 5 MB or smaller.");
  const isPdf = mime === "application/pdf" && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  const isJpeg = mime === "image/jpeg" && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = mime === "image/png" && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (!isPdf && !isJpeg && !isPng) throw new Error("The document content does not match its file type.");
  return { name, mime, buffer };
}

export async function submitEnrollmentGrievance(req: AuthenticatedRequest, res: Response) {
  const user = await studentUser(req, res); if (!user) return;
  const institutionId = typeof req.body?.institutionId === "string" ? req.body.institutionId : "";
  const enrollment = typeof req.body?.enrollmentNumber === "string" ? req.body.enrollmentNumber.trim().toUpperCase() : "";
  const category = typeof req.body?.category === "string" ? req.body.category : "";
  const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
  let evidence: ReturnType<typeof decodeEvidence>;
  try { evidence = decodeEvidence(req.body || {}); }
  catch (error) { return res.status(400).json({ success:false, message:error instanceof Error ? error.message : "Invalid attachment." }); }
  if (!institutionId || !categories.has(category) || description.length < 10 || description.length > 3000) {
    return res.status(400).json({ success:false, message:"Choose a valid data mismatch reason. Additional comments are optional." });
  }
  if (enrollment && enrollment.length > 32) return res.status(400).json({ success:false, message:"Enrollment number is too long." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO public.student_enrollment_grievances
       (student_user_id, institution_id, enrollment_number, grievance_type, category, description)
       VALUES ($1,$2,NULLIF($3,''),'ENROLLMENT_DATA_MISMATCH',$4,$5)
       RETURNING id, category, description, status, created_at AS "createdAt"`,
      [user.id, institutionId, enrollment, category, description],
    );
    await client.query(
      "INSERT INTO public.student_enrollment_grievance_events (grievance_id, actor_type, actor_user_id, event_type, to_status, note) VALUES ($1, 'STUDENT', $2, 'SUBMITTED', $3, $4)",
      [result.rows[0].id, user.id, result.rows[0].status, description.slice(0, 2000)],
    );
    if (evidence) {
      await client.query(
        `INSERT INTO public.student_enrollment_grievance_evidence
         (grievance_id, student_user_id, original_filename, mime_type, file_size, file_data)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [result.rows[0].id, user.id, evidence.name, evidence.mime, evidence.buffer.length, evidence.buffer],
      );
    }
    await client.query("COMMIT");
    return res.status(201).json({ success:true, message:"Your data mismatch request has been sent to our team.", grievance:{ ...result.rows[0], attachmentName:evidence?.name || null } });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Enrollment data mismatch submission failed:", error);
    return res.status(500).json({ success:false, message:"Unable to submit your request. Please try again." });
  } finally { client.release(); }
}


export async function downloadEnrollmentGrievanceAttachmentForAdmin(req: AdminAuthenticatedRequest, res: Response) {
  const institutionId = req.admin?.institutionId;
  if (!req.admin?.adminId || !institutionId) return res.status(403).json({ success:false, message:"Institution Admin access required." });
  try {
    const result = await pool.query(
      `SELECT a.original_filename, a.mime_type, a.file_data
       FROM public.student_enrollment_grievance_evidence a
       JOIN public.student_enrollment_grievances g ON g.id = a.grievance_id
       WHERE g.id = $1 AND g.institution_id = $2 LIMIT 1`,
      [req.params.grievanceId, institutionId],
    );
    if (!result.rowCount) return res.status(404).json({ success:false, message:"Evidence file not found for this institution." });
    const file = result.rows[0];
    res.setHeader("Content-Type", file.mime_type);
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.original_filename)}`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.send(file.file_data);
  } catch (error) {
    console.error("Admin evidence download failed:", error);
    return res.status(500).json({ success:false, message:"Unable to download evidence." });
  }
}

export async function downloadEnrollmentGrievanceAttachmentForSuperAdmin(req: SuperAdminAuthenticatedRequest, res: Response) {
  if (!req.superAdmin?.superAdminId) return res.status(401).json({ success:false, message:"Super Admin authentication required." });
  try {
    const result = await pool.query(
      `SELECT a.original_filename, a.mime_type, a.file_data
       FROM public.student_enrollment_grievance_evidence a
       JOIN public.student_enrollment_grievances g ON g.id = a.grievance_id
       WHERE g.id = $1 LIMIT 1`,
      [req.params.grievanceId],
    );
    if (!result.rowCount) return res.status(404).json({ success:false, message:"Evidence file not found." });
    const file = result.rows[0];
    res.setHeader("Content-Type", file.mime_type);
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.original_filename)}`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.send(file.file_data);
  } catch (error) {
    console.error("Super Admin evidence download failed:", error);
    return res.status(500).json({ success:false, message:"Unable to download evidence." });
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


export async function listEnrollmentGrievancesForAdmin(req: AdminAuthenticatedRequest, res: Response) {
  const institutionId = req.admin?.institutionId;
  if (!req.admin?.adminId) return res.status(401).json({ success:false, message:"Admin authentication required." });
  if (!institutionId) return res.status(403).json({ success:false, message:"This Admin account is not assigned to an institution." });
  try {
    const result = await pool.query(
      `SELECT g.id, g.student_user_id AS "studentUserId", g.enrollment_number AS "enrollmentNumber", g.category, g.description,
              g.status, g.admin_note AS "adminNote", g.created_at AS "createdAt",
              g.updated_at AS "updatedAt", a.original_filename AS "attachmentName", a.mime_type AS "attachmentType",
              to_jsonb(u)->>'email' AS "studentEmail", COALESCE(to_jsonb(u)->>'display_name', to_jsonb(u)->>'full_name', 'Student') AS "studentName"
       FROM public.student_enrollment_grievances g
       LEFT JOIN public.student_enrollment_grievance_evidence a ON a.grievance_id = g.id
       JOIN public.users u ON u.id = g.student_user_id
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
              g.category, g.description, g.status, g.admin_note AS "adminNote",
              g.created_at AS "createdAt", g.updated_at AS "updatedAt",
              a.original_filename AS "attachmentName", a.mime_type AS "attachmentType",
              i.name AS institution, to_jsonb(u)->>'email' AS "studentEmail",
              COALESCE(to_jsonb(u)->>'display_name', to_jsonb(u)->>'full_name', 'Student') AS "studentName"
       FROM public.student_enrollment_grievances g
       LEFT JOIN public.student_enrollment_grievance_evidence a ON a.grievance_id = g.id
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

export async function setEnrollmentGrievanceStudentAccessForSuperAdmin(req: SuperAdminAuthenticatedRequest, res: Response) {
 const actor=req.superAdmin?.superAdminId; const active=req.body?.active; const note=typeof req.body?.note==='string'?req.body.note.trim():'';
 if(!actor)return res.status(401).json({success:false,message:'Super Admin authentication required.'});
 if(typeof active!=='boolean'||note.length<3||note.length>1000)return res.status(400).json({success:false,message:'Choose an account action and provide a reason (3–1,000 characters).'});
 const client=await pool.connect();
 try { await client.query('BEGIN');
 const g=await client.query('SELECT id,student_user_id,status FROM public.student_enrollment_grievances WHERE id=$1 FOR UPDATE',[req.params.grievanceId]);
 if(!g.rowCount){await client.query('ROLLBACK');return res.status(404).json({success:false,message:'Student request not found.'});}
 const uid=g.rows[0].student_user_id;
 const u=await client.query("UPDATE public.users SET active=$2,updated_at=NOW() WHERE id=$1 AND role='STUDENT' AND deleted_at IS NULL RETURNING id,active",[uid,active]);
 if(!u.rowCount){await client.query('ROLLBACK');return res.status(404).json({success:false,message:'Student account was not found or is deleted.'});}
 await client.query("INSERT INTO public.student_enrollment_grievance_events (grievance_id,actor_type,actor_user_id,event_type,note) VALUES ($1,'SUPER_ADMIN',$2,'NOTE_ADDED',$3)",[req.params.grievanceId,actor,'ACCOUNT_'+(active?'ENABLED':'DISABLED')+': '+note]);
 await client.query("INSERT INTO public.student_notifications (user_id,notification_type,title,message,action_url) VALUES ($1,'ENROLLMENT_GRIEVANCE','Student account access updated',$2,'/student/notifications')",[uid,active?'Your Gradly student account has been reactivated.':'Your Gradly student account has been disabled. Contact the platform administrator.']);
 await client.query('COMMIT'); return res.json({success:true,message:active?'Student login reactivated.':'Student login disabled.',student:u.rows[0]});
 } catch(error) { await client.query('ROLLBACK').catch(()=>undefined); console.error('Super Admin grievance account action failed:',error); return res.status(500).json({success:false,message:'Unable to update student access.'}); } finally { client.release(); }
}
export async function listEnrollmentGrievanceAuditHistory(req: SuperAdminAuthenticatedRequest, res: Response) {
  if (!req.superAdmin?.superAdminId) return res.status(401).json({ success:false, message:"Super Admin authentication required." });
  const grievanceId = typeof req.query.grievanceId === "string" ? req.query.grievanceId : "";
  if (!grievanceId) return res.status(400).json({ success:false, message:"A grievance ID is required." });
  try {
    // Read both the current reviewer schema and legacy event rows. to_jsonb(row)
    // keeps this endpoint compatible even if the TO-09 migration has not yet run.
    const result = await pool.query(
      `SELECT e.id::text AS id, e.grievance_id AS "grievanceId",
              COALESCE(to_jsonb(e)->>'reviewer_id', to_jsonb(e)->>'actor_user_id') AS "reviewerId",
              COALESCE(to_jsonb(e)->>'reviewer_role', to_jsonb(e)->>'actor_type') AS "reviewerRole",
              COALESCE(to_jsonb(e)->>'reviewer_id', to_jsonb(e)->>'actor_user_id') AS "actorDisplay",
              COALESCE(to_jsonb(e)->>'event_type', 'DECISION_RECORDED') AS "eventType",
              COALESCE(to_jsonb(e)->>'previous_status', to_jsonb(e)->>'from_status') AS "previousStatus",
              COALESCE(to_jsonb(e)->>'new_status', to_jsonb(e)->>'to_status') AS "newStatus",
              COALESCE(to_jsonb(e)->>'decision_reason', to_jsonb(e)->>'note', '') AS "decisionReason",
              to_jsonb(e)->>'information_request' AS "informationRequest",
              e.created_at AS "createdAt", i.name AS institution,
              to_jsonb(e)->>'programme_scope' AS "programmeScope",
              to_jsonb(e)->>'branch_scope' AS "branchScope",
              COALESCE(to_jsonb(e)->'old_values', '{}'::jsonb) AS "oldValues",
              COALESCE(to_jsonb(e)->'new_values', '{}'::jsonb) AS "newValues"
       FROM public.student_enrollment_grievance_events e
       LEFT JOIN public.student_enrollment_grievances g ON g.id = e.grievance_id
       LEFT JOIN public.institutions i ON i.id = g.institution_id
       WHERE e.grievance_id = $1
       ORDER BY e.created_at DESC, e.id DESC LIMIT 100`,
      [grievanceId],
    );
    return res.json({ success:true, events:result.rows });
  } catch (error) {
    console.error("Enrollment grievance audit history failed:", error);
    return res.status(500).json({ success:false, message:"Unable to load reviewer decision history." });
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
  let mappingBefore: Record<string, unknown> | null = null;
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT g.id, g.institution_id, g.enrollment_number, g.status, g.admin_note,
              COALESCE(to_jsonb(sp)->>'programme_name', to_jsonb(sp)->>'program_name', to_jsonb(sp)->>'programme') AS programme_scope,
              COALESCE(to_jsonb(sp)->>'branch_name', to_jsonb(sp)->>'branch') AS branch_scope
       FROM public.student_enrollment_grievances g
       LEFT JOIN public.student_profiles sp ON sp.user_id = g.student_user_id
       WHERE g.id = $1 AND g.status IN ('PENDING','IN_REVIEW','NEEDS_INFO') FOR UPDATE OF g`,
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
        const before = await client.query(
          `SELECT branch_name AS "branchName", program_name_pattern AS "programNamePattern"
           FROM public.enrollment_branch_codes
           WHERE institution_id = $1 AND branch_code = $2 AND programme_prefix = $3 LIMIT 1`,
          [grievance.institution_id, parsed.branchCode, parsed.prefix],
        );
        mappingBefore = before.rows[0] || null;
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
        const before = await client.query(
          `SELECT scheme_label AS "schemeLabel" FROM public.enrollment_program_rules
           WHERE prefix = $1 AND (institution_id = $2 OR institution_id IS NULL)
           ORDER BY (institution_id = $2) DESC NULLS LAST LIMIT 1`,
          [parsed.prefix, grievance.institution_id],
        );
        mappingBefore = before.rows[0] || null;
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
        const before = await client.query(
          `SELECT mode_name AS "modeName", entry_semester AS "entrySemester"
           FROM public.enrollment_admission_modes
           WHERE institution_id = $1 AND mode_code = $2 AND programme_prefix = $3 LIMIT 1`,
          [grievance.institution_id, parsed.admissionModeCode, parsed.prefix],
        );
        mappingBefore = before.rows[0] || null;
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
        const before = await client.query(
          `SELECT programme_name_pattern AS "programmeNamePattern",
                  programme_alternate_pattern AS "programmeAlternatePattern",
                  programme_alias_patterns AS "programmeAliasPatterns"
           FROM public.enrollment_program_rules
           WHERE prefix = $1 AND (institution_id = $2 OR institution_id IS NULL)
           ORDER BY (institution_id = $2) DESC NULLS LAST LIMIT 1`,
          [parsed.prefix, grievance.institution_id],
        );
        mappingBefore = before.rows[0] || null;
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
    const previous = existing.rows[0];
    const mappingSnapshot = correctionType
      ? { type: correctionType, value: correctionValue, entrySemester: correctionType === "ADMISSION_MODE" ? requestedEntrySemester : null }
      : null;
    // Support both TO-09 reviewer columns and the legacy audit table shape.
    const auditSchema = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'student_enrollment_grievance_events'`,
    );
    const auditColumns = new Set(auditSchema.rows.map((row: { column_name: string }) => row.column_name));
    if (auditColumns.has("reviewer_id")) {
      await client.query(
        `INSERT INTO public.student_enrollment_grievance_events
         (grievance_id, reviewer_id, reviewer_role, institution_id, event_type,
          previous_status, new_status, old_values, new_values, decision_reason)
         VALUES ($1,$2,'SUPER_ADMIN',$3,'STATUS_CHANGED',$4,$5,$6::jsonb,$7::jsonb,$8)`,
        [req.params.grievanceId, superAdminId, previous.institution_id, previous.status, status,
         JSON.stringify({ status: previous.status, adminNote: previous.admin_note || null }),
         JSON.stringify({ status, adminNote: note, mappingCorrection: mappingSnapshot }), note],
      );
    } else {
      await client.query(
        `INSERT INTO public.student_enrollment_grievance_events
         (grievance_id, actor_type, actor_user_id, event_type, from_status, to_status, note)
         VALUES ($1,'SUPER_ADMIN',$2,'STATUS_CHANGED',$3,$4,$5)`,
        [req.params.grievanceId, superAdminId, previous.status, status, note],
      );
    }
    await client.query("COMMIT");
    // Notification delivery is best-effort; a notification error must not undo the reviewer decision.
    try {
      await pool.query(
        `INSERT INTO public.student_notifications (user_id, notification_type, title, message, action_url)
         SELECT student_user_id, 'ENROLLMENT_GRIEVANCE', 'Enrollment grievance updated',
                $2, '/student/notifications'
         FROM public.student_enrollment_grievances WHERE id = $1`,
        [req.params.grievanceId, `Your enrollment grievance status is now ${status.replace(/_/g, " ")}. ${note}`],
      );
    } catch (notificationError) {
      console.error("Enrollment grievance notification failed after decision commit:", notificationError);
    }
    return res.json({ success:true, message:"Enrollment grievance reviewed.", grievance:result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (error instanceof MappingCorrectionError) return res.status(400).json({ success:false, message:error.message });
    console.error("Enrollment grievance review failed:", error);
    return res.status(500).json({ success:false, message:"Unable to update enrollment grievance." });
  } finally {
    client.release();
  }
}


/** Institution Admin review: reject or update a grievance, scoped to the Admin's institution. */
export async function reviewEnrollmentGrievanceForAdmin(req: AdminAuthenticatedRequest, res: Response) {
  const adminId = req.admin?.adminId;
  const institutionId = req.admin?.institutionId;
  const status = req.body?.status;
  const note = typeof req.body?.adminNote === "string" ? req.body.adminNote.trim() : "";
  if (!adminId || !institutionId) return res.status(403).json({ success:false, message:"Institution Admin access required." });
  if (typeof status !== "string" || !["IN_REVIEW","NEEDS_INFO","REJECTED"].includes(status) || note.length < 3 || note.length > 2000) {
    return res.status(400).json({ success:false, message:"Choose a supported review action and provide a note of 3–2,000 characters." });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      "SELECT id, student_user_id, status FROM public.student_enrollment_grievances WHERE id = $1 AND institution_id = $2 AND status IN ('PENDING','IN_REVIEW','NEEDS_INFO') FOR UPDATE",
      [req.params.grievanceId, institutionId],
    );
    if (!existing.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({success:false,message:"Open request not found for your institution."}); }
    const previous = existing.rows[0];
    const updated = await client.query(
      "UPDATE public.student_enrollment_grievances SET status=$2, admin_note=$3, reviewed_by=$4, reviewed_at=NOW(), updated_at=NOW() WHERE id=$1 RETURNING id,status,admin_note AS \"adminNote\"",
      [previous.id, status, note, adminId],
    );
    await client.query(
      "INSERT INTO public.student_enrollment_grievance_events (grievance_id, actor_type, actor_user_id, event_type, from_status, to_status, note) VALUES ($1,'ADMIN',$2,'STATUS_CHANGED',$3,$4,$5)",
      [previous.id, adminId, previous.status, status, note],
    );
    await client.query(
      "INSERT INTO public.student_notifications (user_id, notification_type, title, message, action_url) VALUES ($1,'ENROLLMENT_GRIEVANCE',$2,$3,'/student/notifications')",
      [previous.student_user_id, status==="REJECTED"?"Enrollment request rejected":status==="NEEDS_INFO"?"More information requested":"Enrollment request under review", "Your data mismatch request is now "+status.replace(/_/g," ").toLowerCase()+". "+note],
    );
    await client.query("COMMIT");
    return res.json({success:true,message:status==="REJECTED"?"Request rejected. The student has been notified.":status==="NEEDS_INFO"?"More information requested. The student has been notified.":"Request marked as in review. The student has been notified.",grievance:updated.rows[0]});
  } catch(error) {
    await client.query("ROLLBACK").catch(()=>undefined);
    console.error("Admin grievance rejection failed:",error);
    return res.status(500).json({success:false,message:"Unable to reject this request."});
  } finally { client.release(); }
}

/** Disable/reactivate only a student belonging to the authenticated Admin's institution. */
export async function setEnrollmentGrievanceStudentAccess(req: AdminAuthenticatedRequest, res: Response) {
  const adminId = req.admin?.adminId;
  const institutionId = req.admin?.institutionId;
  const active = req.body?.active;
  const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";
  if (!adminId || !institutionId) return res.status(403).json({success:false,message:"Institution Admin access required."});
  if (typeof active !== "boolean" || note.length < 3 || note.length > 1000) return res.status(400).json({success:false,message:"Choose an account action and provide a reason (3–1,000 characters)."});
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const target = await client.query(
      "SELECT g.student_user_id FROM public.student_enrollment_grievances g WHERE g.id=$1 AND g.institution_id=$2 FOR UPDATE",
      [req.params.grievanceId,institutionId],
    );
    if (!target.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({success:false,message:"Student not found in your institution."}); }
    const userId = target.rows[0].student_user_id;
    const changed = await client.query(
      "UPDATE public.users SET active=$2, updated_at=NOW() WHERE id=$1 AND role='STUDENT' AND deleted_at IS NULL RETURNING id,active",
      [userId,active],
    );
    if (!changed.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({success:false,message:"Student account was not found or is deleted."}); }
    await client.query(
      "INSERT INTO public.student_enrollment_grievance_events (grievance_id,actor_type,actor_user_id,event_type,note) VALUES ($1,'ADMIN',$2,'NOTE_ADDED',$3)",
      [req.params.grievanceId,adminId,"ACCOUNT_"+(active?"ENABLED":"DISABLED")+": "+note],
    );
    await client.query(
      "INSERT INTO public.student_notifications (user_id,notification_type,title,message,action_url) VALUES ($1,'ENROLLMENT_GRIEVANCE','Student account access updated',$2,'/student/notifications')",
      [userId,active?"Your Gradly student account has been reactivated.":"Your Gradly student account has been disabled. Contact your institution administrator."],
    );
    await client.query("COMMIT");
    return res.json({success:true,message:active?"Student login reactivated.":"Student login disabled.",student:changed.rows[0]});
  } catch(error) {
    await client.query("ROLLBACK").catch(()=>undefined);
    console.error("Admin grievance account action failed:",error);
    return res.status(500).json({success:false,message:"Unable to update student access."});
  } finally { client.release(); }
}

/** Super Admin action log combines grievance review events and account audit records. */
export async function listEnrollmentGrievanceAccountActions(req: SuperAdminAuthenticatedRequest, res: Response) {
  if (!req.superAdmin?.superAdminId) return res.status(401).json({success:false,message:"Super Admin authentication required."});
  const grievanceId = typeof req.query.grievanceId === "string" ? req.query.grievanceId : "";
  if (!grievanceId) return res.status(400).json({success:false,message:"A grievance ID is required."});
  try {
    const result = await pool.query(
      `SELECT e.id::text AS id,e.actor_type AS "actorRole",e.actor_user_id AS "actorId",
              e.event_type AS action,e.from_status AS "previousStatus",e.to_status AS "newStatus",
              e.note,e.created_at AS "createdAt"
       FROM public.student_enrollment_grievance_events e
       WHERE e.grievance_id=$1
       UNION ALL
       SELECT a.id::text AS id,a.actor_type AS "actorRole",a.actor_id::text AS "actorId",
              a.action,NULL::text AS "previousStatus",NULL::text AS "newStatus",
              COALESCE(a.metadata->>'note',a.action) AS note,a.created_at AS "createdAt"
       FROM public.audit_logs a
       WHERE a.entity_table='users' AND a.metadata->>'grievanceId'=$1
       ORDER BY "createdAt" DESC LIMIT 150`,
      [grievanceId],
    );
    return res.json({success:true,events:result.rows});
  } catch(error) {
    console.error("Grievance account action history failed:",error);
    return res.status(500).json({success:false,message:"Unable to load account action history."});
  }
}
