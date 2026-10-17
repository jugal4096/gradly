import { Request, Response } from "express";
import {
  RegistrationError,
  registerApprovedAdmin
} from "./admin-registration.service";

interface FirebaseAuthenticatedRequest extends Request {
  firebaseUser?: {
    uid: string;
    email?: string;
  };
}

export async function completeAdminRegistration(
  req: Request,
  res: Response
) {
  try {
    const firebaseUser =
      (req as FirebaseAuthenticatedRequest).firebaseUser;

    if (!firebaseUser?.uid) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    const admin = await registerApprovedAdmin(
      firebaseUser.uid,
      req.body as Record<string, unknown>
    );

    return res.status(201).json({
      success: true,
      message: "Admin registration completed successfully.",
      admin
    });
  } catch (error: unknown) {
    if (error instanceof RegistrationError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }

    console.error("Admin registration failed:", error);

    return res.status(500).json({
      success: false,
      message: "Registration failed. Please try again."
    });
  }
}