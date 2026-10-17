import { Request, Response } from "express";
import {
  ApplicationError,
  getMyAdminApplications,
  submitAdminApplication
} from "./admin-application.service";

interface FirebaseAuthenticatedRequest extends Request {
  firebaseUser?: {
    uid: string;
    email?: string;
    name?: string;
  };
}

function getFirebaseUser(req: Request) {
  const user = (req as FirebaseAuthenticatedRequest).firebaseUser;

  if (!user?.uid) {
    throw new ApplicationError("Authentication required.", 401);
  }

  return user;
}

function sendError(res: Response, error: unknown) {
  if (error instanceof ApplicationError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message
    });
  }

  console.error("Admin application error:", error);

  return res.status(500).json({
    success: false,
    message: "An unexpected server error occurred."
  });
}

export async function submitApplication(
  req: Request,
  res: Response
) {
  try {
    const user = getFirebaseUser(req);

    const application = await submitAdminApplication(
      user.uid,
      user.email,
      req.body as Record<string, unknown>
    );

    return res.status(201).json({
      success: true,
      message: "Your admin application was submitted successfully.",
      application
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getMyApplications(
  req: Request,
  res: Response
) {
  try {
    const user = getFirebaseUser(req);
    const applications = await getMyAdminApplications(user.uid);

    return res.status(200).json({
      success: true,
      applications
    });
  } catch (error) {
    return sendError(res, error);
  }
}