import { Request, Response, NextFunction } from "express";
import { firebaseAuth } from "../config/firebase-admin";
import { recordAuthenticatedActivity } from "../modules/admin/admin-privacy.controller";
import { pool } from "../config/database";

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

    // A valid Firebase token is not enough for a soft-deleted Gradly account.
    // Unknown accounts may still call /auth/sync to create their first Gradly row.
    const account = await pool.query(
      "SELECT active, deleted_at FROM public.users WHERE firebase_uid = $1 LIMIT 1",
      [decodedToken.uid]
    );
    if (account.rows[0] && (!account.rows[0].active || account.rows[0].deleted_at)) {
      return res.status(403).json({ message: "This Gradly account has been deactivated." });
    }

    req.firebaseUser = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      emailVerified: decodedToken.email_verified === true,
    };

    // Update aggregate-only activity tracking. Authentication must still work if telemetry fails.
    try { await recordAuthenticatedActivity(decodedToken.uid); }
    catch (activityError) { console.error("Authenticated activity tracking failed:", activityError); }

    next();
  } catch (error) {
    console.error("Firebase authentication failed:", error);

    return res.status(401).json({
      message: "Invalid or expired authentication token.",
    });
  }
}