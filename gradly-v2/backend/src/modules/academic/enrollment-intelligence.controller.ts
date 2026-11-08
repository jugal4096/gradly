import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { previewEnrollment } from "./enrollment-intelligence.service";

export async function previewEnrollmentController(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const institutionId = typeof req.body?.institutionId === "string" ? req.body.institutionId : "";
    const enrollmentNumber = typeof req.body?.enrollmentNumber === "string" ? req.body.enrollmentNumber : "";
    if (!institutionId || !enrollmentNumber) {
      res.status(400).json({ success: false, message: "Institution and a valid enrollment number are required." });
      return;
    }
    const result = await previewEnrollment(institutionId, enrollmentNumber);
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
