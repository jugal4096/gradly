import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import { createProfile, getStudentProfile, updateProfile } from "./student.service";
import { getGradlyUserByFirebaseUid } from "../auth/auth.service";

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
    admissionYear, currentSemesterNumber, graduationYear, targetCgpa,
  } = body;
  if (
    typeof institutionId !== "string" || !institutionId ||
    typeof curriculumId !== "string" || !curriculumId ||
    typeof studentIdentifier !== "string" || !studentIdentifier.trim() ||
    !Number.isInteger(Number(admissionYear)) ||
    !Number.isInteger(Number(currentSemesterNumber)) ||
    Number(admissionYear) < 1900 ||
    Number(currentSemesterNumber) < 1 || Number(currentSemesterNumber) > 12
  ) return null;

  const parsedTarget = targetCgpa === undefined || targetCgpa === null || targetCgpa === ""
    ? null : Number(targetCgpa);
  if (parsedTarget !== null && (!Number.isFinite(parsedTarget) || parsedTarget < 0 || parsedTarget > 10)) return null;

  return {
    institutionId, curriculumId,
    admissionModeId: typeof admissionModeId === "string" && admissionModeId ? admissionModeId : null,\n    admissionModeName: typeof admissionModeName === "string" ? admissionModeName : null,
    studentIdentifier, admissionYear: Number(admissionYear),
    currentSemesterNumber: Number(currentSemesterNumber),
    graduationYear: graduationYear === undefined || graduationYear === null || graduationYear === ""
      ? null : Number(graduationYear),
    targetCgpa: parsedTarget,
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
    const profile = await createProfile({ ...payload, userId: user.id });
    return res.status(201).json({ message: "Student profile created successfully.", profile });
  } catch (error) {
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
    const profile = await updateProfile({ ...payload, userId: user.id });
    return res.status(200).json({ message: "Student profile updated successfully.", profile });
  } catch (error) {
    if (error instanceof Error && error.message === "Student profile not found.") {
      return res.status(404).json({ message: error.message });
    }
    console.error("Failed to update student profile:", error);
    return res.status(500).json({ message: "Failed to update student profile." });
  }
}
