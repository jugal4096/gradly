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

async function authenticateFirebaseTokenWithOptions(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
  allowDisabledAccount = false
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

    // Disabled users may still access the limited Admin application workflow.
    // They are NOT reactivated: all normal student APIs keep enforcing active=true.
    // Unknown users are allowed through so first-time sign-in can complete /auth/sync.
    const account = await pool.query(
      "SELECT active, deleted_at FROM public.users WHERE firebase_uid = $1 LIMIT 1",
      [decodedToken.uid]
    );
    if (!allowDisabledAccount && account.rowCount && account.rows[0].deleted_at) {
      return res.status(403).json({
        code: "ACCOUNT_DELETED",
        message: "This Gradly account was deleted and can no longer be used to sign in.",
      });
    }
    if (!allowDisabledAccount && account.rowCount && account.rows[0].active !== true) {
      return res.status(403).json({
        code: "ACCOUNT_DISABLED",
        message: "This Gradly account is currently disabled. Please contact the platform administrator.",
      });
    }

    req.firebaseUser = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      emailVerified: decodedToken.email_verified === true,
    };

    // Update aggregate-only activity tracking. Authentication must still work if telemetry fails.
    try {
      await recordAuthenticatedActivity(decodedToken.uid);
    } catch (activityError) {
      console.error("Authenticated activity tracking failed:", activityError);
    }

    next();
  } catch (error) {
    console.error("Firebase authentication failed:", error);

    return res.status(401).json({
      message: "Invalid or expired authentication token.",
    });
  }
}

export function authenticateFirebaseToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  return authenticateFirebaseTokenWithOptions(req, res, next, false);
}

/**
 * Authentication variant for the Admin application only.
 * It verifies Firebase identity but does not block disabled Gradly accounts.
 */
export function authenticateFirebaseTokenForAdminApplication(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  return authenticateFirebaseTokenWithOptions(req, res, next, true);
}
