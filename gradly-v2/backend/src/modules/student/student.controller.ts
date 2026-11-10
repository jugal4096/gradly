import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { createProfile, getStudentProfile, updateProfile } from "./student.service";
import { getGradlyUserByFirebaseUid } from "../auth/auth.service";
import { StudentProfileValidationError, validateStudentProfileConfiguration } from "./student-profile-validation.service";

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
    academicProfileOverrides: {}, // Student-submitted identity overrides are never trusted; corrections require review.
  };
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
    const predictedSemesterNumber = await validateStudentProfileConfiguration(payload);
    const profile = await updateProfile({ ...payload, predictedSemesterNumber, userId: user.id });
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

