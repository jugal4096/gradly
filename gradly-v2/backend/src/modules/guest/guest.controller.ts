import type { Request, Response } from "express";
import { pool } from "../../config/database";
import {
  getGuestSession,
  startGuestSession,
} from "./guest.service";
import {
  recordGuestActivity,
  updateGuestWorkspace,
  listGuestInstitutionOptions,
} from "./guest.repository";

export async function listGuestInstitutions(_req: Request, res: Response) {
  try {
    const institutions = await listGuestInstitutionOptions();
    return res.status(200).json({ institutions });
  } catch (error) {
    console.error("Failed to load guest institution options:", error);
    return res.status(500).json({ message: "Unable to load institutions. Please try again." });
  }
}

export async function createGuest(req: Request, res: Response) {
  try {
    const guestId = typeof req.body?.guestId === "string" ? req.body.guestId : "";
    const institutionId = typeof req.body?.institutionId === "string" ? req.body.institutionId : "";
    const externalName = typeof req.body?.institutionName === "string" ? req.body.institutionName.trim() : "";
    const externalLocality = typeof req.body?.institutionLocality === "string" ? req.body.institutionLocality.trim() : "";
    const externalId = typeof req.body?.externalInstitutionId === "string" ? req.body.externalInstitutionId.trim() : "";
    if (!guestId.trim()) {
      return res.status(400).json({ message: "Choose a unique Guest ID to continue." });
    }
    if (!institutionId.trim() && (!externalName || !externalLocality)) {
      return res.status(400).json({ message: "Select an institution from Gradly or the live institution search." });
    }

    const session = await startGuestSession(guestId, institutionId, externalName && externalLocality ? { name: externalName, locality: externalLocality, externalId } : undefined);
    await recordGuestActivity(session.id, "GUEST_INSTITUTION_SELECTED", {
      institutionId: session.metadata?.institution_id,
      institutionName: session.metadata?.institution_name,
    });
    await recordGuestActivity(session.id, "GUEST_SESSION_CREATED", {
      source: "web",
      guestId: session.metadata?.guest_id ?? session.metadata?.display_id,
      institutionId: session.metadata?.institution_id,
      institutionName: session.metadata?.institution_name,
    });

    return res.status(201).json({
      message: "Guest workspace created successfully.",
      guest: {
        id: session.id,
        guestId: session.metadata?.guest_id ?? session.metadata?.display_id,
        displayName: session.metadata?.display_name ?? session.metadata?.guest_id,
        institutionId: session.metadata?.institution_id,
        institutionName: session.metadata?.institution_name,
        sessionToken: session.sessionToken,
        firstSeenAt: session.first_seen_at,
        lastSeenAt: session.last_seen_at,
        expiresAt: session.expires_at,
      },
    });
  } catch (error) {
    const code = error instanceof Error ? (error as Error & { code?: string }).code : undefined;
    if (code === "GUEST_ID_TAKEN") {
      return res.status(409).json({ code, message: error instanceof Error ? error.message : "That Guest ID is already in use." });
    }
    if (code === "GUEST_INSTITUTION_INVALID") {
      return res.status(400).json({ code, message: error instanceof Error ? error.message : "Choose a valid institution." });
    }
    if (error instanceof Error && error.message.startsWith("Choose a Guest ID")) {
      return res.status(400).json({ message: error.message });
    }
    if (error instanceof Error && error.message.startsWith("Select your institution")) {
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
    await recordGuestActivity(session.id, "GUEST_WORKSPACE_OPENED", {
      source: "web",
      institutionName: session.metadata?.institution_name ?? null,
    });

    return res.status(200).json({
      guest: {
        id: session.id,
        guestId: session.metadata?.guest_id ?? session.metadata?.display_id ?? null,
        displayName: session.metadata?.display_name ?? session.metadata?.guest_id ?? "Guest",
        institutionId: session.metadata?.institution_id ?? null,
        institutionName: session.metadata?.institution_name ?? null,
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


export async function listIndianStates(_req: Request, res: Response) {
  try {
    const response = await fetch("https://countriesnow.space/api/v0.1/countries/states", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ country: "India" }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("India states service unavailable.");
    const data = await response.json() as { error?: boolean; data?: { states?: Array<{ name?: string }> } };
    if (data.error || !Array.isArray(data.data?.states)) throw new Error("Could not read Indian states.");
    return res.status(200).json({ states: data.data.states.map((item) => item.name ?? "").filter(Boolean).sort((a, b) => a.localeCompare(b)) });
  } catch (error) {
    console.error("Could not load Indian states:", error);
    return res.status(502).json({ message: "Could not load Indian states right now. Please try again." });
  }
}

export async function listIndianCities(req: Request, res: Response) {
  const state = typeof req.query.state === "string" ? req.query.state.trim().slice(0, 100) : "";
  if (!state) return res.status(400).json({ message: "Select an Indian state first." });
  try {
    const response = await fetch("https://countriesnow.space/api/v0.1/countries/state/cities", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ country: "India", state }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("India cities service unavailable.");
    const data = await response.json() as { error?: boolean; data?: string[] };
    if (data.error || !Array.isArray(data.data)) throw new Error("Could not read Indian cities.");
    return res.status(200).json({ cities: [...new Set(data.data.filter((item) => typeof item === "string" && item.trim()))].sort((a, b) => a.localeCompare(b)) });
  } catch (error) {
    console.error("Could not load Indian cities:", error);
    return res.status(502).json({ message: "Could not load cities for this state right now. Please try again." });
  }
}

export async function searchGuestInstitutions(req: Request, res: Response) {
  const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  if (query.length < 2) return res.status(200).json({ institutions: [] });

  try {
    const params = new URLSearchParams({
      search: query,
      filter: "country_code:IN,type:education",
      select: "id,display_name,geo,country_code,homepage_url",
      "per-page": "12",
    });
    const response = await fetch("https://api.openalex.org/institutions?" + params.toString(), {
      headers: { Accept: "application/json", "User-Agent": "Gradly/1.0 (institution search)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Institution directory is temporarily unavailable.");
    const data = await response.json() as {
      results?: Array<{
        id?: string; display_name?: string;
        geo?: { city?: string | null; region?: string | null; country?: string | null };
        country_code?: string; homepage_url?: string | null;
      }>;
    };
    const institutions = (data.results ?? []).map((item) => ({
      externalId: item.id ?? "",
      name: item.display_name ?? "",
      city: item.geo?.city ?? "",
      region: item.geo?.region ?? "",
      country: item.geo?.country ?? "India",
      homepageUrl: item.homepage_url ?? null,
    })).filter((item) => item.name && item.externalId);
    return res.status(200).json({ institutions, source: "OpenAlex" });
  } catch (error) {
    console.error("Guest institution search failed:", error);
    return res.status(502).json({ message: "Live institution search is unavailable. You can still request that your college be added." });
  }
}

export async function requestInstitution(req: Request, res: Response) {
  const collegeName = typeof req.body?.collegeName === "string" ? req.body.collegeName.trim() : "";
  const locality = typeof req.body?.locality === "string" ? req.body.locality.trim() : "";
  const guestId = typeof req.body?.guestId === "string" ? req.body.guestId.trim().slice(0, 24) : "";
  const externalInstitutionId = typeof req.body?.externalInstitutionId === "string" ? req.body.externalInstitutionId.trim().slice(0, 200) : "";

  if (collegeName.length < 2 || collegeName.length > 160) {
    return res.status(400).json({ message: "Enter a college name between 2 and 160 characters." });
  }
  if (locality.length < 2 || locality.length > 160) {
    return res.status(400).json({ message: "Enter a locality or city between 2 and 160 characters." });
  }
  if (/[<>]/.test(collegeName) || /[<>]/.test(locality)) {
    return res.status(400).json({ message: "Please remove unsupported characters from the form." });
  }

  try {
    const result = await pool.query(
      `INSERT INTO public.guest_institution_requests
        (college_name, locality, guest_id, external_institution_id, source, status)
       VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), 'GUEST_SETUP', 'PENDING')
       RETURNING id, college_name, locality, guest_id, status, created_at`,
      [collegeName, locality, guestId, externalInstitutionId]
    );
    return res.status(201).json({
      message: "Your institution request has been sent to the Super Admin inbox.",
      request: result.rows[0],
    });
  } catch (error) {
    console.error("Failed to save guest institution request:", error);
    return res.status(503).json({
      message: "We couldn't submit your request right now. Please try again later.",
    });
  }
}
