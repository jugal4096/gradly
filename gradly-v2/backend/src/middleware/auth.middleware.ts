import { Request, Response, NextFunction } from "express";
import { firebaseAuth } from "../config/firebase-admin";
import { pool } from "../config/database";

export interface AuthenticatedRequest extends Request {
  firebaseUser?: {
    uid: string;
    email?: string;
    name?: string;
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

    const account = await pool.query(
      "SELECT active FROM users WHERE firebase_uid = $1 LIMIT 1",
      [decodedToken.uid]
    );
    if (account.rows[0]?.active === false) {
      return res.status(403).json({ message: "This Gradly account has been disabled. Contact support if you believe this is a mistake." });
    }

    req.firebaseUser = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
    };

    next();
  } catch (error) {
    console.error("Firebase authentication failed:", error);

    return res.status(401).json({
      message: "Invalid or expired authentication token.",
    });
  }
}