import { Response } from "express";
import { AuthenticatedRequest } from "../../middleware/auth.middleware";
import {
  getGradlyUserByFirebaseUid,
  synchronizeUser,
} from "./auth.service";

export async function syncAuthUser(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    if (!req.firebaseUser) {
      return res.status(401).json({
        message: "User is not authenticated.",
      });
    }

    const { uid, email, name } = req.firebaseUser;

    if (!email) {
      return res.status(400).json({
        message: "Firebase account does not contain an email address.",
      });
    }

    const user = await synchronizeUser(
      uid,
      email,
      name
    );

    return res.status(200).json({
      message: "User synchronized successfully.",
      user,
    });
  } catch (error) {
    console.error("User synchronization failed:", error);

    return res.status(500).json({
      message: "Failed to synchronize user.",
    });
  }
}

/**
 * Returns the Gradly PostgreSQL user corresponding
 * to the authenticated Firebase user.
 */
export async function getCurrentGradlyUser(
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

    return res.status(200).json({
      user,
    });
  } catch (error) {
    console.error("Failed to get current Gradly user:", error);

    return res.status(500).json({
      message: "Failed to get current user.",
    });
  }
}