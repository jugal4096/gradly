import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { getGradlyUserByFirebaseUid } from "../auth/auth.service";
import { getStudentProfile } from "./student.service";
import { findGecaEnrollmentResults, listGecaResultSessions } from "../tester/tester-result-sync.service";

async function resolveGecaStudent(req: AuthenticatedRequest, res: Response) {
  if (!req.firebaseUser) {
    res.status(401).json({ message: "User is not authenticated." });
    return null;
  }
  const user = await getGradlyUserByFirebaseUid(req.firebaseUser.uid);
  if (!user) {
    res.status(404).json({ message: "Gradly user account was not found." });
    return null;
  }
  const profile = await getStudentProfile(user.id);
  if (!profile) {
    res.status(409).json({ message: "Complete your academic profile before fetching results." });
    return null;
  }
  if (!/government college of engineering/i.test(String(profile.institution_name || ""))) {
    res.status(403).json({ message: "Online result fetching is currently available for Government College of Engineering students." });
    return null;
  }
  if (!profile.academic_profile_confirmed || !String(profile.student_identifier || "").trim()) {
    res.status(409).json({ message: "Confirm your academic profile and enrollment number before fetching results." });
    return null;
  }
  return profile;
}

/** Student-authenticated access to the official GECA archive. No tester token or client-supplied enrollment is accepted. */
export async function listStudentGecaResultSessions(req: AuthenticatedRequest, res: Response) {
  try {
    if (!(await resolveGecaStudent(req, res))) return;
    const sessions = await listGecaResultSessions();
    return res.status(200).json({ success: true, sessions, source: "GECA_OFFICIAL_RESULT_ARCHIVE" });
  } catch (error) {
    console.error("Student GECA result archive lookup failed:", error);
    return res.status(502).json({ success: false, message: error instanceof Error ? error.message : "Unable to load GECA examination sessions." });
  }
}

/** Enrollment is resolved from the authenticated student's confirmed profile, never from request data. */
export async function matchStudentGecaResult(req: AuthenticatedRequest, res: Response) {
  try {
    const profile = await resolveGecaStudent(req, res);
    if (!profile) return;
    const resultId = String(req.params.resultId || "");
    const selectedSemester = Number(req.body?.selectedSemester);
    const currentSemester = Number(profile.current_semester_number || 0);
    if (!Number.isInteger(selectedSemester) || selectedSemester < 1 || selectedSemester > 12 || selectedSemester > currentSemester) {
      return res.status(400).json({ success: false, message: "Choose a semester within your confirmed academic progress." });
    }
    const enrollmentNumber = String(profile.student_identifier || "").trim().toUpperCase();
    const result = await findGecaEnrollmentResults(resultId, enrollmentNumber, selectedSemester);
    return res.status(200).json({ success: true, ...result, enrollmentNumber, readOnly: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to inspect the selected examination result.";
    const status = /valid enrollment|selected examination session|Invalid GECA result session/i.test(message) ? 400 : 502;
    console.error("Student GECA result matching failed:", error);
    return res.status(status).json({ success: false, message });
  }
}
