import type { Request, Response } from "express";
import {
  getGuestSession,
  startGuestSession,
} from "./guest.service";
import {
  recordGuestActivity,
  updateGuestWorkspace,
} from "./guest.repository";

export async function createGuest(req: Request, res: Response) {
  try {
    const displayName = typeof req.body?.displayName === "string" ? req.body.displayName : "";
    if (!displayName.trim()) {
      return res.status(400).json({ message: "Choose a guest display name to continue." });
    }

    const session = await startGuestSession(displayName);
    await recordGuestActivity(session.id, "GUEST_SESSION_CREATED", {
      source: "web",
      displayId: session.metadata?.display_id,
      displayName: session.metadata?.display_name,
    });

    return res.status(201).json({
      message: "Guest session created successfully.",
      guest: {
        id: session.id,
        guestId: session.metadata?.display_id,
        displayName: session.metadata?.display_name,
        sessionToken: session.sessionToken,
        firstSeenAt: session.first_seen_at,
        lastSeenAt: session.last_seen_at,
        expiresAt: session.expires_at,
      },
    });
  } catch (error) {
    if (error instanceof Error && (error as Error & { code?: string }).code === "GUEST_NAME_TAKEN") {
      return res.status(409).json({ code: "GUEST_NAME_TAKEN", message: error.message });
    }
    if (error instanceof Error && error.message.startsWith("Choose a display name")) {
      return res.status(400).json({ message: error.message });
    }
    console.error("Failed to create guest session:", error);
    return res.status(500).json({ message: "Failed to start Guest Mode. Please try again." });
  }
}

export async function getGuest(req: Request, res: Response) {
  try {
    const sessionToken = req.headers["x-guest-session"];
    if (typeof sessionToken !== "string" || !sessionToken) {
      return res.status(401).json({ message: "Guest session token is required." });
    }

    const session = await getGuestSession(sessionToken);
    if (!session) {
      return res.status(401).json({ message: "Guest session is invalid or expired." });
    }

    return res.status(200).json({
      guest: {
        id: session.id,
        guestId: session.metadata?.display_id ?? null,
        displayName: session.metadata?.display_name ?? "Guest",
        firstSeenAt: session.first_seen_at,
        lastSeenAt: session.last_seen_at,
        expiresAt: session.expires_at,
        workspace: session.metadata?.guest_workspace ?? { subjects: [], semesters: [], lastActiveCalculator: "sgpa" },
      },
    });
  } catch (error) {
    console.error("Failed to retrieve guest session:", error);
    return res.status(500).json({ message: "Failed to retrieve guest session." });
  }
}


const allowedGuestActions = new Set([
  "GUEST_FEATURE_LOCK_CLICKED",
  "GUEST_CALCULATOR_SWITCHED",
  "GUEST_SUBJECT_ADDED",
  "GUEST_SUBJECT_REMOVED",
  "GUEST_CGPA_ENTRY_ADDED",
  "GUEST_CGPA_ENTRY_REMOVED",
]);

export async function recordGuestEvent(req: Request, res: Response) {
  try {
    const sessionToken = req.headers["x-guest-session"];
    if (typeof sessionToken !== "string" || !sessionToken) {
      return res.status(401).json({ message: "Guest session token is required." });
    }
    const session = await getGuestSession(sessionToken);
    if (!session) {
      return res.status(401).json({ message: "Guest session is invalid or expired." });
    }
    const action = typeof req.body?.action === "string" ? req.body.action : "";
    if (!allowedGuestActions.has(action)) {
      return res.status(400).json({ message: "Unsupported guest activity event." });
    }

    const incoming = req.body?.metadata && typeof req.body.metadata === "object" && !Array.isArray(req.body.metadata)
      ? req.body.metadata as Record<string, unknown>
      : {};
    const safeMetadata: Record<string, string> = {};
    for (const key of ["feature", "calculator", "itemType"] as const) {
      const value = incoming[key];
      if (typeof value === "string" && value.trim()) safeMetadata[key] = value.trim().slice(0, 80);
    }
    await recordGuestActivity(session.id, action, safeMetadata);
    return res.status(201).json({ message: "Guest activity recorded." });
  } catch (error) {
    console.error("Failed to record guest activity:", error);
    return res.status(500).json({ message: "Could not record guest activity." });
  }
}

export async function saveGuestWorkspace(req: Request, res: Response) {
  try {
    const sessionToken = req.headers["x-guest-session"];
    if (typeof sessionToken !== "string" || !sessionToken) {
      return res.status(401).json({ message: "Guest session token is required." });
    }
    const session = await getGuestSession(sessionToken);
    if (!session) {
      return res.status(401).json({ message: "Guest session is invalid or expired." });
    }

    const workspace = req.body?.workspace;
    if (!workspace || typeof workspace !== "object" || Array.isArray(workspace)) {
      return res.status(400).json({ message: "A valid workspace object is required." });
    }
    const encoded = JSON.stringify(workspace);
    if (encoded.length > 25000) {
      return res.status(413).json({ message: "Your saved calculator workspace is too large." });
    }

    const updated = await updateGuestWorkspace(session.id, workspace as Record<string, unknown>);
    if (!updated) return res.status(404).json({ message: "Guest profile was not found." });

    const subjects = Array.isArray((workspace as { subjects?: unknown }).subjects)
      ? (workspace as { subjects: unknown[] }).subjects.length
      : 0;
    const semesters = Array.isArray((workspace as { semesters?: unknown }).semesters)
      ? (workspace as { semesters: unknown[] }).semesters.length
      : 0;
    await recordGuestActivity(session.id, "GUEST_WORKSPACE_SAVED", { subjectCount: subjects, semesterEntryCount: semesters });

    return res.status(200).json({ message: "Guest workspace saved.", savedAt: updated.last_seen_at });
  } catch (error) {
    console.error("Failed to save guest workspace:", error);
    return res.status(500).json({ message: "Could not save your guest workspace." });
  }
}
