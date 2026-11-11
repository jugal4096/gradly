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
      const invalidCodes = new Set(["EMPTY_ENROLLMENT_NUMBER","INVALID_PROGRAMME_PREFIX","INVALID_ENROLLMENT_LENGTH","INVALID_ADMISSION_YEAR","INVALID_ADMISSION_MODE","INVALID_BRANCH_CODE","INVALID_EIGHTH_CHARACTER","INVALID_STUDENT_SERIAL","DSE_ADMISSION_CYCLE_NOT_STARTED","FUTURE_ADMISSION_YEAR","BE_CBCS_DISCONTINUED","BE23_FIRST_YEAR_NOT_ALLOWED","BT_NEP_NOT_STARTED","POSTGRADUATE_REGULAR_ADMISSION_ONLY","ME_CBCS_DISCONTINUED","MT_NEP_NOT_STARTED"]);
      const message = invalidCodes.has(error.message) ? "Invalid enrollment number." : undefined;
      if (message) {
        res.status(400).json({ success: false, message, code: error.message });
        return;
      }
    }
    console.error("Enrollment preview failed:", error);
    res.status(500).json({ success: false, message: "Unable to identify academic details right now." });
  }
}
