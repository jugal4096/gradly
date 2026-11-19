import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { pool } from "../../config/database";
import { getGradlyUserByFirebaseUid } from "../auth/auth.service";
import { findGecaEnrollmentResults, listGecaResultSessions } from "../tester/tester-result-sync.service";

async function resolveStudentResultProfile(req: AuthenticatedRequest, res: Response) {
  if (!req.firebaseUser?.uid) {
    res.status(401).json({ success: false, message: "User is not authenticated." });
    return null;
  }
  const user = await getGradlyUserByFirebaseUid(req.firebaseUser.uid);
  if (!user) {
    res.status(404).json({ success: false, message: "Gradly user account was not found." });
    return null;
  }
  const result = await pool.query(
    `SELECT student_identifier, current_semester_number
     FROM public.student_profiles
     WHERE user_id = $1 AND academic_profile_confirmed IS TRUE
     LIMIT 1`,
    [user.id],
  );
  const profile = result.rows[0] as { student_identifier: string; current_semester_number: number | null } | undefined;
  if (!profile?.student_identifier) {
    res.status(409).json({ success: false, message: "Complete your confirmed academic profile before fetching results." });
    return null;
  }
  return profile;
}

/** Lists official GECA result sessions for the signed-in student's confirmed academic identity. */
export async function listStudentGecaResultSessions(req: AuthenticatedRequest, res: Response) {
  try {
    const profile = await resolveStudentResultProfile(req, res);
    if (!profile) return;
    const sessions = await listGecaResultSessions();
    return res.status(200).json({ success: true, sessions, source: "GECA_OFFICIAL_RESULT_ARCHIVE", readOnly: true });
  } catch (error) {
    console.error("Student GECA result archive lookup failed:", error);
    return res.status(502).json({ success: false, message: error instanceof Error ? error.message : "Unable to load GECA examination sessions." });
  }
}

/** Scans the selected GECA session using the enrollment stored on the authenticated student's profile. */
export async function matchStudentGecaResult(req: AuthenticatedRequest, res: Response) {
  try {
    const profile = await resolveStudentResultProfile(req, res);
    if (!profile) return;
    const resultId = String(req.params.resultId || "");
    const selectedSemester = Number(req.body?.selectedSemester);
    if (!Number.isInteger(selectedSemester) || selectedSemester < 1 || selectedSemester > Number(profile.current_semester_number || 0)) {
      return res.status(400).json({ success: false, message: "Choose a semester within your confirmed academic profile." });
    }
    const reExamTargetCourseCode = typeof req.body?.reExamTargetCourseCode === "string" ? req.body.reExamTargetCourseCode.trim() : undefined;
    const result = await findGecaEnrollmentResults(resultId, profile.student_identifier, selectedSemester, reExamTargetCourseCode);
    return res.status(200).json({ success: true, ...result, readOnly: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to inspect the selected examination result.";
    const status = /valid enrollment|selected examination session|Invalid GECA result session/i.test(message) ? 400 : 502;
    console.error("Student GECA result matching failed:", error);
    return res.status(status).json({ success: false, message });
  }
}
