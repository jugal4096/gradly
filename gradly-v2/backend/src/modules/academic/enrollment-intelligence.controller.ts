import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { previewEnrollment } from "./enrollment-intelligence.service";

export async function previewEnrollmentController(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const institutionId = typeof req.body?.institutionId === "string" ? req.body.institutionId : "";
    const enrollmentNumber = typeof req.body?.enrollmentNumber === "string" ? req.body.enrollmentNumber : "";
    if (!institutionId || !enrollmentNumber || enrollmentNumber.length > 64) {
      res.status(400).json({ success: false, message: "Institution and a valid enrollment number are required." });
      return;
    }
    const result = await previewEnrollment(institutionId, enrollmentNumber);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_ENROLLMENT_NUMBER") {
      res.status(400).json({ success: false, message: "Enter a valid enrollment number." });
      return;
    }
    console.error("Enrollment preview failed:", error);
    res.status(500).json({ success: false, message: "Unable to identify academic details right now." });
  }
}
