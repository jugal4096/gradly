import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import {
  createProfile,
  getStudentProfile,
} from "./student.service";
import { getGradlyUserByFirebaseUid } from "../auth/auth.service";

export async function getProfile(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.firebaseUser) {
      return res.status(401).json({
        message: "User is not authenticated.",
      });
    }

    const user = await getGradlyUserByFirebaseUid(
      req.firebaseUser.uid
    );

    if (!user) {
      return res.status(404).json({
        message: "Gradly user account was not found.",
      });
    }

    const profile = await getStudentProfile(user.id);

    return res.status(200).json({
      profile,
    });
  } catch (error) {
    console.error("Failed to get student profile:", error);

    return res.status(500).json({
      message: "Failed to get student profile.",
    });
  }
}

export async function createStudentProfileController(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.firebaseUser) {
      return res.status(401).json({
        message: "User is not authenticated.",
      });
    }

    const user = await getGradlyUserByFirebaseUid(
      req.firebaseUser.uid
    );

    if (!user) {
      return res.status(404).json({
        message:
          "Gradly user account was not found. Please synchronize your account first.",
      });
    }

    const {
      institutionId,
      curriculumId,
      admissionModeId,
      studentIdentifier,
      admissionYear,
      currentSemesterNumber,
      graduationYear,
      targetCgpa,
    } = req.body;

    if (
      !institutionId ||
      !curriculumId ||
      !studentIdentifier ||
      admissionYear === undefined ||
      currentSemesterNumber === undefined
    ) {
      return res.status(400).json({
        message: "Required student profile fields are missing.",
      });
    }

    const profile = await createProfile({
      userId: user.id,
      institutionId,
      curriculumId,
      admissionModeId: admissionModeId ?? null,
      studentIdentifier,
      admissionYear: Number(admissionYear),
      currentSemesterNumber: Number(currentSemesterNumber),
      graduationYear:
        graduationYear !== undefined &&
        graduationYear !== null
          ? Number(graduationYear)
          : null,
      targetCgpa:
        targetCgpa !== undefined &&
        targetCgpa !== null
          ? Number(targetCgpa)
          : null,
    });

    return res.status(201).json({
      message: "Student profile created successfully.",
      profile,
    });
  } catch (error) {
    console.error(
      "Failed to create student profile:",
      error
    );

    if (
      error instanceof Error &&
      error.message === "Student profile already exists."
    ) {
      return res.status(409).json({
        message: error.message,
      });
    }

    return res.status(500).json({
      message: "Failed to create student profile.",
    });
  }
}