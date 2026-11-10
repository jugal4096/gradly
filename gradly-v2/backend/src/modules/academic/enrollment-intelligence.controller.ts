import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { previewEnrollment } from "./enrollment-intelligence.service";
import { pool } from "../../config/database";
import { getGradlyUserByFirebaseUid } from "../auth/auth.service";

export async function previewEnrollmentController(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const institutionId = typeof req.body?.institutionId === "string" ? req.body.institutionId : "";
    const enrollmentNumber = typeof req.body?.enrollmentNumber === "string" ? req.body.enrollmentNumber : "";
    if (!institutionId || !enrollmentNumber) {
      res.status(400).json({ success: false, message: "Institution and a valid enrollment number are required." });
      return;
    }
    const normalizedEnrollment = enrollmentNumber.trim().toUpperCase();
    const user = req.firebaseUser?.uid ? await getGradlyUserByFirebaseUid(req.firebaseUser.uid) : null;
    if (!user) { res.status(404).json({ success:false, message:"Gradly account was not found. Sign in again." }); return; }
    const owner = await pool.query(
      `SELECT user_id FROM public.student_profiles WHERE LOWER(BTRIM(student_identifier)) = LOWER(BTRIM($1)) LIMIT 1`,
      [normalizedEnrollment],
    );
    if (owner.rows[0] && owner.rows[0].user_id !== user.id) {
      res.status(409).json({ success:false, code:"ENROLLMENT_ALREADY_CLAIMED", message:"This enrollment number is already linked to another Gradly account. If this is your legitimate enrollment number, submit an enrollment grievance." });
      return;
    }
    const curriculumId = typeof req.body?.curriculumId === "string" ? req.body.curriculumId : undefined;
    const result = await previewEnrollment(institutionId, normalizedEnrollment, new Date(), curriculumId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error) {
      const validationMessages: Record<string, string> = {
        EMPTY_ENROLLMENT_NUMBER: "Enter your enrollment number.",
        INVALID_PROGRAMME_PREFIX: "Invalid enrollment number. Programme prefix is not recognized.",
        INVALID_ENROLLMENT_LENGTH: "Invalid enrollment number. It must contain exactly 11 characters.",
        INVALID_ADMISSION_YEAR: "Invalid enrollment number. Admission year must contain two digits.",
        INVALID_ADMISSION_MODE: "Invalid enrollment number. Admission mode must be F or S.",
        INVALID_BRANCH_CODE: "Unrecognized branch code. Please verify your enrollment number.",
        INVALID_EIGHTH_CHARACTER: "Invalid enrollment number. The 8th character must be F.",
        INVALID_STUDENT_SERIAL: "Invalid enrollment number. The last three characters must contain only digits.",
        DSE_ADMISSION_CYCLE_NOT_STARTED: "Direct Second Year admission for this enrollment year has not started yet. DSE intake becomes eligible only when the corresponding first-year cohort enters its second academic year, at the start of that session (normally July).",
        FUTURE_ADMISSION_YEAR: "Invalid enrollment number. This academic admission year has not started yet; future-dated enrollment numbers are not accepted.",
        BE_CBCS_DISCONTINUED: "Invalid enrollment number. The BE New CBCS scheme was discontinued after 2023; BE24 and later are not valid.",
        BE23_FIRST_YEAR_NOT_ALLOWED: "Invalid enrollment number. BE23F is not valid because first-year admissions moved to NEP. BE23S Direct Second Year remains valid.",
        BT_NEP_NOT_STARTED: "Invalid enrollment number. BT enrollment numbers before 2023 are not valid under the NEP scheme.",
      };
      const message = validationMessages[error.message];
      if (message) {
        res.status(400).json({ success: false, message, code: error.message });
        return;
      }
    }
    console.error("Enrollment preview failed:", error);
    res.status(500).json({ success: false, message: "Unable to identify academic details right now." });
  }
}
