import { Request, Response, NextFunction } from "express";
import { firebaseAuth } from "../config/firebase-admin";

export interface AuthenticatedRequest extends Request {
  firebaseUser?: {
    uid: string;
    email?: string;
    name?: string;
    emailVerified?: boolean;
  };
}

export async function authenticateFirebaseToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Missing Firebase authentication token.",
      });
    }

    const token = authorization.split("Bearer ")[1];

    const decodedToken = await firebaseAuth.verifyIdToken(token);

    req.firebaseUser = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      emailVerified: decodedToken.email_verified === true,
    };

    next();
  } catch (error) {
    console.error("Firebase authentication failed:", error);

    return res.status(401).json({
      message: "Invalid or expired authentication token.",
    });
  }
}