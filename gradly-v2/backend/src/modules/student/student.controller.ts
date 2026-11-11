import { Response } from "express";
import { pool } from "../../config/database";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { createProfile, getStudentProfile, updateProfile } from "./student.service";
import { getGradlyUserByFirebaseUid } from "../auth/auth.service";
import { StudentProfileValidationError, validateStudentProfileConfiguration } from "./student-profile-validation.service";
import { hasConfirmedAcademicIdentityChanged } from "./student-profile-identity";

async function resolveStudentUser(req: AuthenticatedRequest, res: Response) {
  if (!req.firebaseUser) {
    res.status(401).json({ message: "User is not authenticated." });
    return null;
  }
  const user = await getGradlyUserByFirebaseUid(req.firebaseUser.uid);
  if (!user) {
    res.status(404).json({ message: "Gradly user account was not found. Please synchronize your account first." });
    return null;
  }
  return user;
}

function readProfilePayload(body: Record<string, unknown>) {
  const {
    institutionId, curriculumId, admissionModeId, admissionModeName, studentIdentifier,
    admissionYear, currentSemesterNumber, graduationYear, targetCgpa, predictedSemesterNumber, academicGapYears,
  } = body;
  const academicProfileConfirmed = body.academicProfileConfirmed === true;
  const pendingBacklogCount = body.pendingBacklogCount === undefined || body.pendingBacklogCount === null
    ? null : Number(body.pendingBacklogCount);
  const academicStatus = body.academicStatus ?? "ENROLLED";
  const parsedPredictedSemester = predictedSemesterNumber === undefined || predictedSemesterNumber === null || predictedSemesterNumber === "" ? null : Number(predictedSemesterNumber);
  const parsedGapYears = academicGapYears === undefined || academicGapYears === null || academicGapYears === "" ? null : Number(academicGapYears);
  if (
    !academicProfileConfirmed ||
    typeof institutionId !== "string" || !institutionId ||
    typeof curriculumId !== "string" || !curriculumId ||
    typeof studentIdentifier !== "string" || !studentIdentifier.trim() ||
    !Number.isInteger(Number(admissionYear)) ||
    Number(admissionYear) < 1900 ||
    !["ENROLLED", "AWAITING_RESULTS", "PENDING_BACKLOGS", "APPROVED_EXTENSION", "GRADUATED"].includes(String(academicStatus)) ||
    Number(admissionYear) > new Date().getFullYear() ||
    (parsedPredictedSemester !== null && (!Number.isInteger(parsedPredictedSemester) || parsedPredictedSemester < 1 || parsedPredictedSemester > 20)) ||
    (parsedGapYears !== null && (!Number.isInteger(parsedGapYears) || parsedGapYears < 0 || parsedGapYears > 10)) ||
    (currentSemesterNumber !== null && currentSemesterNumber !== undefined &&
      (!Number.isInteger(Number(currentSemesterNumber)) || Number(currentSemesterNumber) < 1 || Number(currentSemesterNumber) > 20)) ||
    (academicStatus !== "GRADUATED" && (currentSemesterNumber === null || currentSemesterNumber === undefined))
  ) return null;

  if (body.pendingBacklogCount !== undefined && body.pendingBacklogCount !== null &&
      (!Number.isInteger(pendingBacklogCount) || Number(pendingBacklogCount) < 0 || Number(pendingBacklogCount) > 100)) return null;

  const parsedTarget = targetCgpa === undefined || targetCgpa === null || targetCgpa === ""
    ? null : Number(targetCgpa);
  if (parsedTarget !== null && (!Number.isFinite(parsedTarget) || parsedTarget < 0 || parsedTarget > 10)) return null;

  return {
    institutionId, curriculumId,
    admissionModeId: typeof admissionModeId === "string" && admissionModeId ? admissionModeId : null,
    admissionModeName: typeof admissionModeName === "string" ? admissionModeName : null,
    studentIdentifier: String(studentIdentifier).trim().toUpperCase(), admissionYear: Number(admissionYear),
    currentSemesterNumber: currentSemesterNumber === null || currentSemesterNumber === undefined ? null : Number(currentSemesterNumber),
    academicStatus: String(academicStatus),
    graduationYear: graduationYear === undefined || graduationYear === null || graduationYear === ""
      ? null : Number(graduationYear),
    targetCgpa: parsedTarget,
    academicProfileConfirmed,
    pendingBacklogCount,
    predictedSemesterNumber: parsedPredictedSemester,
    academicGapYears: parsedGapYears,
    academicProfileOverrides: body.academicProfileOverrides && typeof body.academicProfileOverrides === "object" && !Array.isArray(body.academicProfileOverrides) ? body.academicProfileOverrides : {},
  };
}

/** Promote a confirmed student profile by exactly one semester during the January/July window. */
export async function promoteCurrentSemester(req: AuthenticatedRequest, res: Response) {
  try {
    const user = await resolveStudentUser(req, res);
    if (!user) return;
    const requested = Number(req.body?.currentSemesterNumber);
    const month = new Date().getUTCMonth() + 1;
    if (month !== 1 && month !== 7) {
      return res.status(403).json({ code: "SEMESTER_PROMOTION_CLOSED", message: "Semester promotion is available only in January and July, after the December and June examination cycles." });
    }
    if (!Number.isInteger(requested) || requested < 2 || requested > 12) {
      return res.status(400).json({ message: "Select a valid next semester." });
    }
    const result = await pool.query(
      `UPDATE public.student_profiles sp
       SET current_semester_number = $2, updated_at = NOW()
       FROM public.users u, public.curricula c
       WHERE sp.user_id = u.id AND u.id = $1 AND u.active = TRUE
         AND u.deleted_at IS NULL AND sp.curriculum_id = c.id
         AND sp.academic_profile_confirmed IS TRUE
         AND sp.academic_status <> 'GRADUATED'
         AND $2 = sp.current_semester_number + 1
         AND $2 <= COALESCE(c.total_semesters, 12)
       RETURNING sp.id, sp.current_semester_number`,
      [user.id, requested]
    );
    if (!result.rowCount) {
      return res.status(409).json({ code: "SEMESTER_PROMOTION_NOT_ALLOWED", message: "You can move forward by exactly one semester only during the January/July promotion window. Your academic identity remains locked." });
    }
    await pool.query(
      `INSERT INTO public.audit_logs
       (actor_type, actor_id, actor_role, action, entity_table, entity_id, metadata)
       VALUES ('STUDENT', $1, 'STUDENT', 'STUDENT_SEMESTER_PROMOTED', 'student_profiles', $2, $3::jsonb)`,
      [user.id, result.rows[0].id, JSON.stringify({ currentSemesterNumber: requested, promotionWindow: month === 1 ? "JANUARY" : "JULY" })]
    );
    return res.status(200).json({ message: "Semester updated. Your academic profile is locked again.", currentSemesterNumber: requested, locked: true });
  } catch (error) {
    console.error("Semester promotion failed:", error);
    return res.status(500).json({ message: "Unable to update your current semester." });
  }
}

export async function getProfile(req: AuthenticatedRequest, res: Response) {
  try {
    const user = await resolveStudentUser(req, res);
    if (!user) return;
    const profile = await getStudentProfile(user.id);
    return res.status(200).json({ profile });
  } catch (error) {
    console.error("Failed to get student profile:", error);
    return res.status(500).json({ message: "Failed to get student profile." });
  }
}

export async function createStudentProfileController(req: AuthenticatedRequest, res: Response) {
  try {
    const user = await resolveStudentUser(req, res);
    if (!user) return;
    const payload = readProfilePayload(req.body ?? {});
    if (!payload) return res.status(400).json({ message: "Invalid or missing student profile fields." });
    const predictedSemesterNumber = await validateStudentProfileConfiguration(payload);
    const profile = await createProfile({ ...payload, predictedSemesterNumber, userId: user.id });
    return res.status(201).json({ message: "Student profile created successfully.", profile });
  } catch (error) {
    if (error instanceof StudentProfileValidationError) return res.status(400).json({ success:false, code:error.code, message:error.message });
    if ((error as { code?: string })?.code === "23505") return res.status(409).json({ success:false, code:"ENROLLMENT_ALREADY_CLAIMED", message:"This enrollment number is already linked to another Gradly account. Submit an enrollment grievance if this is your legitimate enrollment number." });
    if (error instanceof Error && error.message === "Student profile already exists.") {
      return res.status(409).json({ message: error.message });
    }
    console.error("Failed to create student profile:", error);
    return res.status(500).json({ message: "Failed to create student profile." });
  }
}

export async function updateStudentProfileController(req: AuthenticatedRequest, res: Response) {
  try {
    const user = await resolveStudentUser(req, res);
    if (!user) return;
    const payload = readProfilePayload(req.body ?? {});
    if (!payload) return res.status(400).json({ message: "Invalid or missing student profile fields." });
    const existingProfile = await getStudentProfile(user.id);
    if (!existingProfile) return res.status(404).json({ message: "Student profile not found." });
    if (existingProfile.academic_profile_confirmed === true) {
      if (hasConfirmedAcademicIdentityChanged(existingProfile, payload)) {
        return res.status(409).json({
          success:false,
          code:"ACADEMIC_IDENTITY_LOCKED",
          message:"Your confirmed institution, programme, branch, scheme, enrollment number, admission year and admission mode are locked. Submit an enrollment grievance for an official correction.",
        });
      }
      payload.academicProfileConfirmed = true;
      payload.academicProfileOverrides = existingProfile.academic_profile_overrides &&
        typeof existingProfile.academic_profile_overrides === "object" &&
        !Array.isArray(existingProfile.academic_profile_overrides)
        ? existingProfile.academic_profile_overrides
        : {};
    }
    const predictedSemesterNumber = await validateStudentProfileConfiguration(payload);
    const profile = await updateProfile({ ...payload, predictedSemesterNumber, userId: user.id });
    if (!profile) {
      return res.status(409).json({
        success:false,
        code:"ACADEMIC_IDENTITY_LOCKED",
        message:"Your confirmed academic identity changed during this update. Reload your profile and submit an enrollment grievance for any official correction.",
      });
    }
    return res.status(200).json({ message: "Student profile updated successfully.", profile });
  } catch (error) {
    if (error instanceof StudentProfileValidationError) return res.status(400).json({ success:false, code:error.code, message:error.message });
    if ((error as { code?: string })?.code === "23505") return res.status(409).json({ success:false, code:"ENROLLMENT_ALREADY_CLAIMED", message:"This enrollment number is already linked to another Gradly account. Submit an enrollment grievance if this is your legitimate enrollment number." });
    if (error instanceof Error && error.message === "Student profile not found.") {
      return res.status(404).json({ message: error.message });
    }
    console.error("Failed to update student profile:", error);
    return res.status(500).json({ message: "Failed to update student profile." });
  }
}



/** Student-requested account deletion. The account is disabled and soft-deleted;
 * the original ID, profile, academic records and audit history remain available
 * only through the protected Super Admin directory.
 */
export async function deleteOwnStudentAccount(req: AuthenticatedRequest, res: Response) {
  const firebaseUid = req.firebaseUser?.uid;
  if (!firebaseUid) return res.status(401).json({ message: "User is not authenticated." });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const account = await client.query(
      `SELECT id, role, deleted_at FROM public.users
       WHERE firebase_uid = $1 FOR UPDATE`,
      [firebaseUid]
    );
    if (!account.rowCount || account.rows[0].role !== "STUDENT") {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Student account was not found." });
    }
    if (account.rows[0].deleted_at) {
      await client.query("ROLLBACK");
      return res.status(410).json({ message: "This student account has already been deleted." });
    }
    const userId = account.rows[0].id;
    await client.query(
      `UPDATE public.users
       SET active = FALSE, deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    await client.query(
      `INSERT INTO public.audit_logs
       (actor_type, actor_id, actor_role, action, entity_table, entity_id, ip_address, metadata)
       VALUES ('STUDENT', $1, 'STUDENT', 'STUDENT_SELF_DELETED_ACCOUNT',
               'users', $1, $2, $3::jsonb)`,
      [userId, req.ip || req.socket.remoteAddress || null,
       JSON.stringify({ initiatedBy: "STUDENT", softDeleted: true, retainedAcademicRecords: true })]
    );
    await client.query("COMMIT");
    return res.status(200).json({
      message: "Your Gradly account has been deleted. Your original student ID and academic records are retained for authorised Super Admin review.",
      deleted: true,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Student self-service account deletion failed:", error);
    return res.status(500).json({ message: "Unable to delete your Gradly account. Please try again." });
  } finally {
    client.release();
  }
}
