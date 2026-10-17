import { Request, Response } from "express";
import {
  getGuestSession,
  startGuestSession,
} from "./guest.service";

export async function createGuest(_req: Request, res: Response) {
  try {
    const session = await startGuestSession();

    return res.status(201).json({
      message: "Guest session created successfully.",
      guest: {
        id: session.id,
        sessionToken: session.sessionToken,
        firstSeenAt: session.first_seen_at,
        lastSeenAt: session.last_seen_at,
        expiresAt: session.expires_at,
      },
    });
  } catch (error) {
    console.error("Failed to create guest session:", error);

    return res.status(500).json({
      message: "Failed to create guest session.",
    });
  }
}

export async function getGuest(req: Request, res: Response) {
  try {
    const sessionToken = req.headers["x-guest-session"];

    if (typeof sessionToken !== "string" || !sessionToken) {
      return res.status(401).json({
        message: "Guest session token is required.",
      });
    }

    const session = await getGuestSession(sessionToken);

    if (!session) {
      return res.status(401).json({
        message: "Guest session is invalid or expired.",
      });
    }

    return res.status(200).json({
      guest: {
        id: session.id,
        firstSeenAt: session.first_seen_at,
        lastSeenAt: session.last_seen_at,
        expiresAt: session.expires_at,
      },
    });
  } catch (error) {
    console.error("Failed to retrieve guest session:", error);

    return res.status(500).json({
      message: "Failed to retrieve guest session.",
    });
  }
}